// Word → PDF server: POST /convert (multipart field "file") → application/pdf, converted by LibreOffice.
// Zero dependencies. Also serves the built web app from ./public.
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { patchDocx } = require('./word-compat');

const PORT = Number(process.env.PORT) || 3000;
const SOFFICE = process.env.SOFFICE || 'soffice';
const MAX_BYTES = 50 * 1024 * 1024;
const TIMEOUT_MS = 120_000;
const MAX_JOBS = Math.max(1, Number(process.env.MAX_JOBS) || os.cpus().length);
const ALLOWED = new Set(['.docx', '.doc', '.odt', '.rtf']);
// Simple concurrency gate: LibreOffice is CPU/RAM heavy.
let running = 0;
const waiting = [];
async function slot(fn) {
  if (running >= MAX_JOBS) await new Promise(r => waiting.push(r));
  running++;
  try { return await fn(); } finally { running--; waiting.shift()?.(); }
}

async function convert(buf, ext) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'w2p-'));
  try {
    const input = path.join(dir, 'input' + ext); // fixed name: user filenames never touch the filesystem
    await fs.writeFile(input, ext === '.docx' ? patchDocx(buf).buf : buf);
    await new Promise((resolve, reject) => execFile(SOFFICE, [
      // Own profile per job, so parallel conversions don't fight over one LibreOffice instance.
      '-env:UserInstallation=' + new URL('file:' + path.join(dir, 'profile').replace(/\\/g, '/')).href,
      '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', dir, input,
    ], { timeout: TIMEOUT_MS, killSignal: 'SIGKILL' }, (err, _o, stderr) => err ? reject(new Error(stderr || err.message)) : resolve()));
    return await fs.readFile(path.join(dir, 'input.pdf'));
  } finally {
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// The built React app (web/dist, copied to ./public by the Dockerfile).
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
async function serveStatic(req, res) {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(PUBLIC, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden'); // no ../ escapes
  try {
    const data = await fs.readFile(file);
    // Hashed asset names never change content, so they can be cached for good.
    const cache = rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': cache });
  } catch {
    send(res, 404, 'Not found');
  }
}

function send(res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...extra });
  res.end(body);
}

http.createServer(async (req, res) => {
  try {
    // Behind Heroku's router: send plain-http visitors to https (local requests have no such header).
    if (req.headers['x-forwarded-proto'] === 'http' && req.headers.host)
      return send(res, 301, '', 'text/plain', { Location: `https://${req.headers.host}${req.url}` });
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, 'ok');
    if (req.method === 'GET') return serveStatic(req, res);
    if (req.method !== 'POST' || req.url !== '/convert') return send(res, 404, 'Not found');

    if (Number(req.headers['content-length'] || 0) > MAX_BYTES) return send(res, 413, 'File too large (max 50 MB)');
    // Count bytes as they stream too, in case content-length is missing or wrong.
    const body = (async function* () {
      let seen = 0;
      for await (const c of req) { if ((seen += c.length) > MAX_BYTES) throw new RangeError('too large'); yield c; }
    })();
    let form;
    try { form = await new Request('http://x/', { method: 'POST', headers: { 'content-type': req.headers['content-type'] || '' }, body, duplex: 'half' }).formData(); }
    catch (e) {
      const tooBig = e instanceof RangeError || e.cause instanceof RangeError;
      return send(res, tooBig ? 413 : 400, tooBig ? 'File too large (max 50 MB)' : 'Expected a multipart upload');
    }
    const file = form.get('file');
    if (!file || typeof file === 'string') return send(res, 400, 'Missing "file" field');
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED.has(ext)) return send(res, 415, 'Only .docx, .doc, .odt and .rtf are supported');

    const buf = Buffer.from(await file.arrayBuffer());
    // LibreOffice will happily "convert" any junk as plain text, so check the real file signature.
    const magic = { '.docx': 'PK\x03\x04', '.odt': 'PK\x03\x04', '.doc': '\xD0\xCF\x11\xE0', '.rtf': '{\\rtf' }[ext];
    if (!buf.subarray(0, magic.length).equals(Buffer.from(magic, 'latin1'))) return send(res, 422, 'Not a valid ' + ext + ' file');
    const pdf = await slot(() => convert(buf, ext));
    const name = path.basename(file.name, path.extname(file.name)) + '.pdf';
    send(res, 200, pdf, 'application/pdf', { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, 'Conversion failed — is the file a valid document?');
  }
}).listen(PORT, () => console.log(`Word to PDF server on http://localhost:${PORT} (soffice: ${SOFFICE})`));
