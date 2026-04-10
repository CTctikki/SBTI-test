import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(rootDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

function indexOfRequired(text) {
  const index = html.indexOf(text);
  assert.ok(index >= 0, `expected homepage to include ${text}`);
  return index;
}

test('homepage keeps the approved static stats and ranking order', () => {
  const completedCount = indexOfRequired('已有 12,631 人完成测试');
  const rankingTitle = indexOfRequired('人气排行');
  const measuredTag = indexOfRequired('12,631 人已测');
  const upgradeSection = indexOfRequired('版本升级 / 我们新增了什么');
  const studioSection = indexOfRequired('CT 程序定制工作室');

  assert.ok(upgradeSection < rankingTitle, 'expected 人气排行 to appear after 版本升级 / 我们新增了什么');
  assert.ok(rankingTitle < studioSection, 'expected 人气排行 to appear before CT 程序定制工作室');
  assert.ok(completedCount < rankingTitle, 'expected homepage completion count to appear before the ranking card');
  assert.ok(measuredTag > rankingTitle, 'expected 12,631 人已测 to appear within the ranking card');

  for (const code of ['LOVE-R', 'SEXY', 'MALO', 'OJBK', 'CTRL', 'FAKE', 'SOLO', 'SHIT', 'ZZZZ', 'IMSB']) {
    indexOfRequired(code);
  }

  for (const percentage of ['11.7%', '9.7%', '6.4%']) {
    indexOfRequired(percentage);
  }
});
