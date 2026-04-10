import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
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

function loadFunctionInSandbox(source, name, sandbox) {
  const functionSource = loadFunctionSource(source, name);
  const context = vm.createContext({ ...sandbox });
  vm.runInContext(`result = (${functionSource});`, context);
  return context.result;
}

function createDomNode(initial = {}) {
  const node = {
    textContent: initial.textContent ?? '',
    innerHTML: initial.innerHTML ?? '',
    className: initial.className ?? '',
    children: [],
    parentNode: null,
    style: {},
    dataset: {},
    classList: {
      add(...classes) {
        node.className = [node.className, ...classes].filter(Boolean).join(' ').trim();
      },
      remove(...classes) {
        const removals = new Set(classes);
        node.className = node.className
          .split(/\s+/)
          .filter((className) => className && !removals.has(className))
          .join(' ');
      },
      contains(className) {
        return node.className.split(/\s+/).includes(className);
      },
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    getAttribute(name) {
      return this[name];
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    insertAdjacentHTML(position, htmlSnippet) {
      this.lastInsert = { position, htmlSnippet };
      this.innerHTML = `${this.innerHTML}${htmlSnippet}`;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  return node;
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

  const nodes = {
    introStatsLine: createDomNode(),
    rankingTotal: createDomNode(),
    rankingList: createDomNode(),
    rankingPanel: createDomNode({ className: 'ranking-panel' }),
  };

  const renderHomepageStats = loadFunctionInSandbox(html, 'renderHomepageStats', {
    HOMEPAGE_STATS: stats,
    document: {
      getElementById(id) {
        return nodes[id] ?? null;
      },
      querySelector(selector) {
        if (selector === '#introStatsLine') return nodes.introStatsLine;
        if (selector === '#rankingTotal') return nodes.rankingTotal;
        if (selector === '#rankingList') return nodes.rankingList;
        if (selector === '.ranking-panel') return nodes.rankingPanel;
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
    window: {},
  });

  renderHomepageStats();

  assert.equal(
    nodes.introStatsLine.textContent,
    '已有 12,631 人完成测试',
    'expected renderHomepageStats() to populate the intro stats line',
  );
  assert.equal(
    nodes.rankingTotal.textContent,
    '12,631 人已测',
    'expected renderHomepageStats() to populate the ranking total',
  );
  assert.ok(
    nodes.rankingList.innerHTML.includes('LOVE-R'),
    'expected renderHomepageStats() to render the top-10 ranking list',
  );
  assert.ok(
    nodes.rankingList.innerHTML.includes('11.7%'),
    'expected renderHomepageStats() to render ranking percentages',
  );
});

test('homepage stats markup is scoped to the dedicated stats block', () => {
  const introSectionMatch = html.match(
    /<div class="hero card hero-minimal">([\s\S]*?<section class="studio-promo"[\s\S]*?<\/section>)/,
  );
  assert.ok(introSectionMatch, 'expected intro section markup slice to exist');

  const introSection = introSectionMatch[1];
  const upgradePanel = introSection.indexOf('upgrade-panel');
  const rankingPanel = introSection.indexOf('ranking-panel');
  const studioPromo = introSection.indexOf('studio-promo');

  assert.ok(upgradePanel >= 0, 'expected upgrade-panel markup to exist in the intro section');
  assert.ok(rankingPanel >= 0, 'expected ranking-panel markup to exist in the intro section');
  assert.ok(studioPromo >= 0, 'expected studio-promo markup to exist in the intro section');
  assert.ok(
    upgradePanel < rankingPanel,
    'expected the ranking panel to appear after the version upgrade panel within the intro section',
  );
  assert.ok(
    rankingPanel < studioPromo,
    'expected the ranking panel to appear before the CT 程序定制工作室 block within the intro section',
  );
});
