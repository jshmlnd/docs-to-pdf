// node --test   (fixtures in test-docs/compat were made by Word itself)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { patchDocx, readZip, text } = require('./word-compat');

const load = n => fs.readFileSync(`${__dirname}/test-docs/compat/${n}.docx`);
const part = (buf, name) => text(readZip(buf).find(e => e.name === name));
const breakParagraphPPr = xml => xml.match(/<w:pPr>(?:(?!<\/w:pPr>)[\s\S])*?<w:sectPr/)[0];

test('Word 2010 mode, 2-column section before a continuous break: space after dropped', () => {
  const src = load('m14-2col-after30');
  assert.match(breakParagraphPPr(part(src, 'word/document.xml')), /w:after="600"/);
  const { buf, changed } = patchDocx(src);
  assert.strictEqual(changed, 1);
  const pPr = breakParagraphPPr(part(buf, 'word/document.xml'));
  assert.match(pPr, /<w:spacing w:after="0"/);
  assert.doesNotMatch(pPr, /w:after="600"/);
});

test('rewritten zip keeps every other part byte-identical', () => {
  const src = load('m14-2col-after30');
  const before = readZip(src), after = readZip(patchDocx(src).buf);
  assert.deepStrictEqual(after.map(e => e.name), before.map(e => e.name));
  for (const [i, e] of before.entries()) if (e.name !== 'word/document.xml') assert.strictEqual(text(after[i]), text(e));
});

test('single-column section: Word keeps the space, so no change', () => {
  assert.strictEqual(patchDocx(load('m14-1col-after30')).changed, 0);
});

test('Word 2013+ mode: no change (LibreOffice already matches)', () => {
  const src = load('sec1-2col-after30');
  const { buf, changed } = patchDocx(src);
  assert.strictEqual(changed, 0);
  assert.strictEqual(buf, src);
});

test('not a zip: original returned untouched', () => {
  const junk = Buffer.from('PK\x03\x04 definitely not a real zip');
  assert.strictEqual(patchDocx(junk).buf, junk);
});
