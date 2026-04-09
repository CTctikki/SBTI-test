import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(rootDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

const requiredIds = ['shareTitle', 'shareRoast', 'shareCaption', 'shareHook', 'shareTags'];
const requiredCodes = ['CTRL', 'SHIT', 'SOLO', 'FAKE', 'LOVE-R', 'ZZZZ', 'IMSB', 'HHHH', 'DRUNK', 'FUCK'];

function parseObjectLiteral(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`));
  assert.ok(match, `${name} should exist in index.html`);
  return Function(`return ({${match[1]}\n});`)();
}

test('result page exposes share fields and helpers', () => {
  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), `expected ${id} to exist`);
  }

  assert.match(html, /function buildShareMeta\(type\)/, 'expected buildShareMeta helper');
  assert.match(html, /function renderShareMeta\(type\)/, 'expected renderShareMeta helper');
  assert.match(html, /renderShareMeta\(type\)/, 'expected renderResult to call renderShareMeta');
});

test('TYPE_LIBRARY includes share metadata for the core meme personas', () => {
  const typeLibrary = parseObjectLiteral(html, 'TYPE_LIBRARY');

  for (const code of requiredCodes) {
    const entry = typeLibrary[code];
    assert.ok(entry, `expected TYPE_LIBRARY to include ${code}`);
    assert.equal(typeof entry.shareTitle, 'string', `${code}.shareTitle should be a string`);
    assert.equal(typeof entry.shareRoast, 'string', `${code}.shareRoast should be a string`);
    assert.equal(typeof entry.shareCaption, 'string', `${code}.shareCaption should be a string`);
    assert.equal(typeof entry.shareHook, 'string', `${code}.shareHook should be a string`);
    assert.ok(Array.isArray(entry.shareTags), `${code}.shareTags should be an array`);
    assert.ok(entry.shareTags.length >= 2, `${code}.shareTags should include at least 2 tags`);
  }
});
