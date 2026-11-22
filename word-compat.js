// Word layout quirks LibreOffice doesn't emulate, fixed by editing the .docx before conversion.
// Zero dependencies: a tiny zip reader/writer good enough for .docx files.
const zlib = require('node:zlib');

// --- zip ---------------------------------------------------------------------------------
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 5, 6]));
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10), time = buf.readUInt16LE(p + 12), date = buf.readUInt16LE(p + 14);
    const crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (csize === 0xffffffff || local === 0xffffffff) throw new Error('zip64 not supported');
    const name = buf.subarray(p + 46, p + 46 + nlen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    entries.push({ name: name.toString('utf8'), nameBuf: name, method, time, date, crc, usize, data: buf.subarray(start, start + csize) });
    p += 46 + nlen + xlen + clen;
  }
  return entries;
}

const text = e => (e.method === 0 ? e.data : zlib.inflateRawSync(e.data)).toString('utf8');

function setText(e, str) {
  const raw = Buffer.from(str, 'utf8');
  Object.assign(e, { method: 8, data: zlib.deflateRawSync(raw), crc: zlib.crc32(raw), usize: raw.length });
}

function writeZip(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); // utf-8 names
    head.writeUInt16LE(e.method, 8); head.writeUInt16LE(e.time, 10); head.writeUInt16LE(e.date, 12);
    head.writeUInt32LE(e.crc, 14); head.writeUInt32LE(e.data.length, 18); head.writeUInt32LE(e.usize, 22);
    head.writeUInt16LE(e.nameBuf.length, 26);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(e.method, 10); cd.writeUInt16LE(e.time, 12); cd.writeUInt16LE(e.date, 14);
    cd.writeUInt32LE(e.crc, 16); cd.writeUInt32LE(e.data.length, 20); cd.writeUInt32LE(e.usize, 24);
    cd.writeUInt16LE(e.nameBuf.length, 28); cd.writeUInt32LE(offset, 42);
    parts.push(head, e.nameBuf, e.data);
    central.push(cd, e.nameBuf);
    offset += 30 + e.nameBuf.length + e.data.length;
  }
  const cdBuf = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, end]);
}

// --- Word rules --------------------------------------------------------------------------

// Word 2010 mode and older: when a multi-column section ends at a continuous section break,
// Word drops the "space after" of the section's last paragraph (column balancing ignores it).
// Word 2013+ and LibreOffice keep it, which pushes everything after the break down.
function dropSpaceAfterAtBalancedBreaks(xml) {
  const sects = [...xml.matchAll(/<w:sectPr\b[^>]*?(?:\/>|>[\s\S]*?<\/w:sectPr>)/g)];
  const edits = [];
  sects.forEach((m, i) => {
    const next = sects[i + 1]?.[0];
    const cols = Number(m[0].match(/<w:cols\b[^>]*\bw:num="(\d+)"/)?.[1] || 1);
    if (cols < 2 || !next || !/<w:type\b[^>]*w:val="continuous"/.test(next)) return;
    // Only section breaks that live in a paragraph's properties end a section mid-document.
    const pPrStart = Math.max(xml.lastIndexOf('<w:pPr>', m.index), xml.lastIndexOf('<w:pPr ', m.index));
    if (pPrStart < 0 || xml.lastIndexOf('</w:pPr>', m.index) > pPrStart) return;
    edits.push(pPrStart);
  });
  // Apply from the end so earlier offsets stay valid.
  for (const at of edits.reverse()) {
    const open = xml.indexOf('>', at) + 1, close = xml.indexOf('</w:pPr>', at);
    const pPr = xml.slice(open, close);
    // <w:rPr> inside pPr has its own <w:spacing> (character spacing); only touch the paragraph's.
    const rPrAt = pPr.indexOf('<w:rPr');
    const head = rPrAt < 0 ? pPr : pPr.slice(0, rPrAt), tail = pPr.slice(head.length);
    const spacing = head.match(/<w:spacing\b[^>]*\/>/);
    const fixed = (spacing
      ? head.replace(spacing[0], spacing[0].replace(/\s+w:(after|afterLines|afterAutospacing)="[^"]*"/g, '').replace('<w:spacing', '<w:spacing w:after="0"'))
      : head.replace(/^(<w:pStyle\b[^>]*\/>)?/, '$1<w:spacing w:after="0"/>')) + tail;
    xml = xml.slice(0, open) + fixed + xml.slice(close);
  }
  return { xml, changed: edits.length };
}

// Returns a patched copy of a .docx, or the original buffer when nothing applies or anything fails.
function patchDocx(buf) {
  try {
    const entries = readZip(buf);
    const doc = entries.find(e => e.name === 'word/document.xml');
    const settings = entries.find(e => e.name === 'word/settings.xml');
    if (!doc) return { buf, changed: 0 };
    // No compatibilityMode setting means the file predates Word 2010 (mode 12 or older).
    const mode = Number(settings && text(settings).match(/w:name="compatibilityMode"[^>]*w:val="(\d+)"/)?.[1]) || 12;
    if (mode >= 15) return { buf, changed: 0 };
    const { xml, changed } = dropSpaceAfterAtBalancedBreaks(text(doc));
    if (!changed) return { buf, changed: 0 };
    setText(doc, xml);
    return { buf: writeZip(entries), changed };
  } catch {
    return { buf, changed: 0 }; // never block a conversion over a layout tweak
  }
}

module.exports = { patchDocx, readZip, text };
