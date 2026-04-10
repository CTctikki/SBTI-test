import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(rootDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

function extractBracedBlock(source, startIndex) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inSingle) {
      if (!escaped && char === "'") inSingle = false;
      escaped = !escaped && char === '\\';
      continue;
    }

    if (inDouble) {
      if (!escaped && char === '"') inDouble = false;
      escaped = !escaped && char === '\\';
      continue;
    }

    if (inTemplate) {
      if (!escaped && char === '`') inTemplate = false;
      escaped = !escaped && char === '\\';
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      escaped = false;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      escaped = false;
      continue;
    }

    if (char === '`') {
      inTemplate = true;
      escaped = false;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  assert.fail('could not find matching brace');
}

function parseConstObject(source, name) {
  const anchor = `const ${name}`;
  const anchorIndex = source.indexOf(anchor);
  assert.ok(anchorIndex >= 0, `expected ${name} config object in index.html`);

  const equalsIndex = source.indexOf('=', anchorIndex + anchor.length);
  assert.ok(equalsIndex >= 0, `expected ${name} assignment in index.html`);

  const objectStart = source.indexOf('{', equalsIndex);
  assert.ok(objectStart >= 0, `expected ${name} object literal in index.html`);

  const objectSource = extractBracedBlock(source, objectStart);
  return Function(`return (${objectSource});`)();
}

function loadFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `expected ${name} helper in index.html`);

  const braceStart = source.indexOf('{', start);
  assert.ok(braceStart >= 0, `expected ${name} helper to have a body`);

  return extractBracedBlock(source, braceStart);
}

function loadFunctionInSandbox(source, name, sandbox) {
  const functionSource = loadFunctionSource(source, name);
  const context = vm.createContext({ console, ...sandbox });
  vm.runInContext(`result = (${functionSource});`, context);
  return context.result;
}

function createDomNode(initial = {}) {
  const node = {
    children: [],
    parentNode: null,
    style: {},
    dataset: {},
    className: initial.className ?? '',
    tagName: initial.tagName ?? 'DIV',
    _textContent: initial.textContent ?? '',
    _innerHTML: initial.innerHTML ?? '',
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
      this._innerHTML = this.children.map(serializeNode).join('');
      this._textContent = this.children.map((item) => item.textContent ?? '').join('');
      return child;
    },
    replaceChildren(...children) {
      this.children = [];
      this._innerHTML = '';
      this._textContent = '';
      for (const child of children) {
        this.appendChild(child);
      }
    },
    append(...children) {
      for (const child of children) {
        if (typeof child === 'string') {
          this._innerHTML += child;
          this._textContent += child;
          continue;
        }
        this.appendChild(child);
      }
    },
    insertAdjacentHTML(position, htmlSnippet) {
      this.lastInsert = { position, htmlSnippet };
      this._innerHTML = `${this._innerHTML}${htmlSnippet}`;
      this._textContent = `${this._textContent}${htmlSnippet}`;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  Object.defineProperty(node, 'textContent', {
    get() {
      if (node.children.length > 0 && node._textContent === '') {
        return node.children.map((item) => item.textContent ?? '').join('');
      }
      return node._textContent;
    },
    set(value) {
      node._textContent = String(value);
      node.children = [];
      node._innerHTML = String(value);
    },
  });

  Object.defineProperty(node, 'innerHTML', {
    get() {
      if (node.children.length > 0 && node._innerHTML === '') {
        return node.children.map(serializeNode).join('');
      }
      return node._innerHTML;
    },
    set(value) {
      node._innerHTML = String(value);
      node.children = [];
      node._textContent = stripTags(String(value));
    },
  });

  return node;
}

function serializeNode(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node;

  const tagName = (node.tagName ?? 'div').toLowerCase();
  const text = node.children?.length ? node.children.map(serializeNode).join('') : (node._textContent ?? node.textContent ?? '');
  return `<${tagName}>${text}</${tagName}>`;
}

function stripTags(value) {
  return value.replace(/<[^>]*>/g, '');
}

function extractSectionById(source, id) {
  const openTagMatch = source.match(new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>`));
  assert.ok(openTagMatch, `expected section #${id} to exist`);

  const startIndex = openTagMatch.index;
  const openTag = openTagMatch[0];
  const sectionStart = startIndex + openTag.length;

  let depth = 1;
  const sectionTagRegex = /<\/?section\b[^>]*>/gi;
  sectionTagRegex.lastIndex = sectionStart;

  for (let match = sectionTagRegex.exec(source); match; match = sectionTagRegex.exec(source)) {
    if (match[0][1] === '/') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, match.index + match[0].length);
      }
    } else {
      depth += 1;
    }
  }

  assert.fail(`could not find closing section tag for #${id}`);
}

function formatCompletedCount(count) {
  return `\u5df2\u6709 ${count.toLocaleString('en-US')} \u4eba\u5b8c\u6210\u6d4b\u8bd5`;
}

function formatRankingTotal(count) {
  return `${count.toLocaleString('en-US')} \u4eba\u5df2\u6d4b`;
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
    rankingPanel: createDomNode({ className: 'ranking-panel', tagName: 'SECTION' }),
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
      createElement(tagName) {
        return createDomNode({ tagName: tagName.toUpperCase() });
      },
      createTextNode(text) {
        return createDomNode({ textContent: text, tagName: '#text' });
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
    formatCompletedCount(12631),
    'expected renderHomepageStats() to populate the intro stats line',
  );
  assert.equal(
    nodes.rankingTotal.textContent,
    formatRankingTotal(12631),
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
  const introSection = extractSectionById(html, 'intro');
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
