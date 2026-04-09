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

function loadNamedFunction(source, name, nextName) {
  const start = source.indexOf(`function ${name}(type) {`);
  assert.ok(start >= 0, `${name} should exist in index.html`);
  const end = source.indexOf(`function ${nextName}(type) {`, start);
  assert.ok(end > start, `${nextName} should follow ${name} in index.html`);
  const fnSource = source.slice(start, end).trimEnd();
  return Function(`${fnSource}; return ${name};`)();
}

test('result page exposes share fields and helpers', () => {
  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), `expected ${id} to exist`);
  }

  assert.match(html, /function buildShareMeta\(type\)/, 'expected buildShareMeta helper');
  assert.match(html, /function renderShareMeta\(type\)/, 'expected renderShareMeta helper');
  assert.match(html, /renderShareMeta\(type\)/, 'expected renderResult to call renderShareMeta');
});

test('TYPE_LIBRARY core personas keep their approved share metadata', () => {
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

test('buildShareMeta provides usable share copy for every TYPE_LIBRARY entry', () => {
  const typeLibrary = parseObjectLiteral(html, 'TYPE_LIBRARY');
  const buildShareMeta = loadNamedFunction(html, 'buildShareMeta', 'renderShareMeta');

  for (const [code, type] of Object.entries(typeLibrary)) {
    const shareMeta = buildShareMeta(type);

    assert.equal(typeof shareMeta.title, 'string', `${code}.title should be a string`);
    assert.ok(shareMeta.title.trim(), `${code}.title should not be empty`);
    assert.equal(typeof shareMeta.roast, 'string', `${code}.roast should be a string`);
    assert.ok(shareMeta.roast.trim(), `${code}.roast should not be empty`);
    assert.equal(typeof shareMeta.caption, 'string', `${code}.caption should be a string`);
    assert.ok(shareMeta.caption.trim(), `${code}.caption should not be empty`);
    assert.equal(typeof shareMeta.hook, 'string', `${code}.hook should be a string`);
    assert.ok(shareMeta.hook.trim(), `${code}.hook should not be empty`);
    assert.ok(Array.isArray(shareMeta.tags), `${code}.tags should be an array`);
    assert.ok(shareMeta.tags.length >= 2, `${code}.tags should include at least 2 tags`);
    for (const tag of shareMeta.tags) {
      assert.equal(typeof tag, 'string', `${code}.tags entries should be strings`);
      assert.ok(tag.trim(), `${code}.tags entries should not be empty`);
    }
  }
});
