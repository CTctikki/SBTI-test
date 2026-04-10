import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(rootDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

function parseConstObject(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`));
  assert.ok(match, `expected ${name} config object in index.html`);
  return Function(`return ({${match[1]}\n});`)();
}

function loadFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `expected ${name} helper in index.html`);

  const braceStart = source.indexOf('{', start);
  assert.ok(braceStart >= 0, `expected ${name} helper to have a body`);

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  assert.fail(`could not parse ${name} helper`);
}

function requireSnippet(haystack, needle, message) {
  if (needle instanceof RegExp) {
    assert.ok(needle.test(haystack), message);
    return;
  }

  assert.ok(haystack.includes(needle), message);
}

test('homepage stats config and renderer exist with the approved data', () => {
  const stats = parseConstObject(html, 'HOMEPAGE_STATS');

  assert.equal(stats.completedCount, 12631, 'expected HOMEPAGE_STATS.completedCount to be 12631');
  assert.ok(Array.isArray(stats.popularRankings), 'expected HOMEPAGE_STATS.popularRankings to exist');
  assert.equal(stats.popularRankings.length, 10, 'expected HOMEPAGE_STATS.popularRankings to include 10 entries');

  const expectedRankings = [
    { code: 'LOVE-R', percentage: '11.7%' },
    { code: 'SEXY', percentage: '9.7%' },
    { code: 'MALO', percentage: '6.4%' },
    { code: 'OJBK', percentage: '5.0%' },
    { code: 'CTRL', percentage: '4.8%' },
    { code: 'FAKE', percentage: '4.5%' },
    { code: 'SOLO', percentage: '4.1%' },
    { code: 'SHIT', percentage: '3.8%' },
    { code: 'ZZZZ', percentage: '3.5%' },
    { code: 'IMSB', percentage: '3.2%' },
  ];

  for (let index = 0; index < expectedRankings.length; index += 1) {
    const expected = expectedRankings[index];
    const actual = stats.popularRankings[index];

    assert.ok(actual, `expected ranking ${index + 1} to exist`);
    assert.equal(actual.code, expected.code, `expected ranking ${index + 1} code to be ${expected.code}`);
    assert.equal(
      actual.percentage,
      expected.percentage,
      `expected ranking ${index + 1} percentage to be ${expected.percentage}`,
    );
  }

  const renderHomepageStats = loadFunctionSource(html, 'renderHomepageStats');
  assert.match(renderHomepageStats, /\bHOMEPAGE_STATS\b/, 'expected renderHomepageStats() to use HOMEPAGE_STATS');
  assert.match(renderHomepageStats, /\bintroStatsLine\b/, 'expected renderHomepageStats() to render the intro stats line');
  assert.match(renderHomepageStats, /\brankingTotal\b/, 'expected renderHomepageStats() to render the ranking total');
  assert.match(renderHomepageStats, /\brankingList\b/, 'expected renderHomepageStats() to render the ranking list');
});

test('homepage stats markup is scoped to the dedicated stats block', () => {
  requireSnippet(html, 'id="introStatsLine"', 'expected introStatsLine markup to exist');
  requireSnippet(html, 'id="rankingTotal"', 'expected rankingTotal markup to exist');
  requireSnippet(html, 'id="rankingList"', 'expected rankingList markup to exist');
  requireSnippet(html, 'class="ranking-panel"', 'expected ranking-panel markup to exist');

  const upgradePanel = html.indexOf('upgrade-panel');
  const rankingPanel = html.indexOf('ranking-panel');
  const studioPromo = html.indexOf('studio-promo');

  assert.ok(upgradePanel >= 0, 'expected upgrade-panel markup to exist');
  assert.ok(rankingPanel >= 0, 'expected ranking-panel markup to exist');
  assert.ok(studioPromo >= 0, 'expected studio-promo markup to exist');
  assert.ok(
    upgradePanel < rankingPanel,
    'expected the ranking panel to appear after the version upgrade panel',
  );
  assert.ok(
    rankingPanel < studioPromo,
    'expected the ranking panel to appear before the CT 程序定制工作室 block',
  );
});
