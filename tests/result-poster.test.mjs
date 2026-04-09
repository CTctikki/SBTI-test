import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(rootDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

function parseObjectLiteral(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`));
  assert.ok(match, `${name} should exist in index.html`);
  return Function(`return ({${match[1]}\n});`)();
}

test('every result poster image referenced by TYPE_IMAGES exists in the repo', () => {
  const images = parseObjectLiteral(html, 'TYPE_IMAGES');

  for (const [code, relPath] of Object.entries(images)) {
    const normalized = relPath.replace(/^\.\//, '');
    const fullPath = path.join(rootDir, normalized);
    assert.equal(
      existsSync(fullPath),
      true,
      `Expected poster asset for ${code} at ${normalized}`,
    );
  }
});

test('result poster has retry-ready fallback markup and logic', () => {
  assert.match(html, /id="posterStatus"/, 'result panel should expose a poster status node');
  assert.match(html, /id="retryPosterBtn"/, 'result panel should expose a retry button');
  assert.match(html, /function loadPosterImage\(/, 'rendering should use a dedicated poster loader');
  assert.match(html, /图片加载失败/, 'fallback copy should explain the image load failure');
});
