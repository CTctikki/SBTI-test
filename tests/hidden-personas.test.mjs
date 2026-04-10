import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(rootDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

function parseQuestions(source) {
  const match = source.match(/const questions = \[([\s\S]*?)\r?\n\s*\];\r?\n\s*const specialQuestions = \[/);
  assert.ok(match, 'questions array should exist in index.html');
  return Function(`return ([${match[1]}\n]);`)();
}

function parseObjectLiteral(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`));
  assert.ok(match, `${name} should exist in index.html`);
  return Function(`return ({${match[1]}\n});`)();
}

function loadFunctionInSandbox(source, functionName, sandbox) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.ok(start >= 0, `${functionName} should exist in index.html`);

  const braceStart = source.indexOf('{', start);
  assert.ok(braceStart >= 0, `${functionName} should have a body`);

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const functionSource = source.slice(start, index + 1);
        const context = vm.createContext({ ...sandbox });
        vm.runInContext(`result = (${functionSource});`, context);
        return context.result;
      }
    }
  }

  assert.fail(`could not parse ${functionName}`);
}

function createHiddenResultHarness() {
  const questions = parseQuestions(html);
  const dimensionOrder = ['S1', 'S2', 'S3', 'E1', 'E2', 'E3', 'A1', 'A2', 'A3', 'Ac1', 'Ac2', 'Ac3', 'So1', 'So2', 'So3'];
  const dimensionMeta = Object.fromEntries(dimensionOrder.map((dim) => [dim, { name: dim }]));
  const answersById = Object.fromEntries(questions.map((question) => [question.id, 2]));
  const typeLibrary = parseObjectLiteral(html, 'TYPE_LIBRARY');
  let drunkFlag = false;

  const computeResult = loadFunctionInSandbox(html, 'computeResult', {
    questions,
    dimensionMeta,
    dimensionOrder,
    app: { answers: answersById },
    NORMAL_TYPES: [{ code: 'TEST', pattern: 'MMMMMMMMMMMMMMM' }],
    TYPE_LIBRARY: typeLibrary,
    parsePattern: (pattern) => pattern.replace(/-/g, '').split(''),
    levelNum: (level) => ({ L: 1, M: 2, H: 3 }[level]),
    sumToLevel: (score, questionCount) => {
      const minScore = questionCount;
      const maxScore = questionCount * 3;
      const normalized = (score - minScore) / (maxScore - minScore);
      if (normalized < 1 / 3) return 'L';
      if (normalized < 2 / 3) return 'M';
      return 'H';
    },
    getSeenZenTriggered: () => answersById.q31 === 1 && answersById.q32 === 3 && answersById.q43 === 3,
    getDeleteArtistTriggered: () => answersById.q32 === 3 && answersById.q37 === 1 && answersById.q50 === 1,
    getFoundrTriggered: () => answersById.q33 === 1 && answersById.q42 === 2 && answersById.q49 === 1,
    getSubMarTriggered: () => answersById.q31 === 1 && answersById.q43 === 3 && answersById.q44 === 1,
    getDrunkTriggered: () => drunkFlag
  });

  return {
    answersById,
    computeResult,
    questions,
    setDrunk(value) {
      drunkFlag = value;
    }
  };
}

const hiddenPersonas = [
  {
    code: 'SEEN-ZEN',
    cn: '已读不回仙人',
    helper: 'getSeenZenTriggered',
    answers: { q31: 1, q32: 3, q43: 3 }
  },
  {
    code: 'DEL-ART',
    cn: '深夜删文艺术家',
    helper: 'getDeleteArtistTriggered',
    answers: { q32: 3, q37: 1, q50: 1 }
  },
  {
    code: 'FOUNDR',
    cn: '收藏夹创业者',
    helper: 'getFoundrTriggered',
    answers: { q33: 1, q42: 2, q49: 1 }
  },
  {
    code: 'SUB-MAR',
    cn: '群聊核潜艇',
    helper: 'getSubMarTriggered',
    answers: { q31: 1, q43: 3, q44: 1 }
  }
];

test('hidden persona assets, helpers, and codes are wired into the app', () => {
  const typeImages = parseObjectLiteral(html, 'TYPE_IMAGES');

  for (const code of hiddenPersonas.map((persona) => persona.code)) {
    assert.match(html, new RegExp(code), `expected ${code} to be present in index.html`);
    assert.equal(existsSync(path.join(rootDir, 'image', `${code}.png`)), true, `expected image/${code}.png to exist`);
    assert.equal(typeImages[code], `./image/${code}.png`, `expected TYPE_IMAGES to use PNG for ${code}`);
  }

  for (const { helper } of hiddenPersonas) {
    assert.match(html, new RegExp(`function ${helper}\\(`), `expected ${helper} to exist in index.html`);
  }

  const typeLibrary = parseObjectLiteral(html, 'TYPE_LIBRARY');
  for (const { code, cn } of hiddenPersonas) {
    assert.ok(typeLibrary[code], `expected TYPE_LIBRARY to include ${code}`);
    assert.equal(typeLibrary[code].cn, cn, `${code} should keep approved Chinese name`);
  }
});

test('hidden persona helpers honor the corrected q32 and q43 polarity', () => {
  const questions = parseQuestions(html);
  const answersById = Object.fromEntries(questions.map((question) => [question.id, 2]));
  const seenZen = loadFunctionInSandbox(html, 'getSeenZenTriggered', { app: { answers: answersById } });
  const deleteArtist = loadFunctionInSandbox(html, 'getDeleteArtistTriggered', { app: { answers: answersById } });
  const subMar = loadFunctionInSandbox(html, 'getSubMarTriggered', { app: { answers: answersById } });

  answersById.q31 = 1;
  answersById.q32 = 1;
  answersById.q43 = 1;
  assert.equal(seenZen(), false, 'old q32/q43 values should no longer trigger SEEN-ZEN');
  assert.equal(deleteArtist(), false, 'old q32 value should no longer trigger DEL-ART');
  assert.equal(subMar(), false, 'old q43 value should no longer trigger SUB-MAR');

  answersById.q32 = 3;
  answersById.q43 = 3;
  assert.equal(seenZen(), true, 'corrected q32/q43 values should trigger SEEN-ZEN');

  answersById.q37 = 1;
  answersById.q50 = 1;
  assert.equal(deleteArtist(), true, 'corrected q32 value should trigger DEL-ART');

  answersById.q44 = 1;
  assert.equal(subMar(), true, 'corrected q43 value should trigger SUB-MAR');
});

test('computeResult resolves each new hidden persona for its crafted answer set', () => {
  const harness = createHiddenResultHarness();

  for (const persona of hiddenPersonas) {
    for (const question of harness.questions) {
      harness.answersById[question.id] = 2;
    }
    for (const [questionId, value] of Object.entries(persona.answers)) {
      harness.answersById[questionId] = value;
    }
    harness.setDrunk(false);
    const result = harness.computeResult();
    assert.equal(result.finalType.code, persona.code, `${persona.code} should win for its trigger answers`);
    assert.equal(result.finalType.cn, persona.cn, `${persona.code} should keep approved Chinese name`);
    assert.equal(result.secondaryType.code, 'TEST', `${persona.code} should keep the best normal persona as secondaryType`);
    assert.equal(result.modeKicker, '隐藏人格已激活', `${persona.code} should use hidden persona kicker`);
    assert.equal(result.special, true, `${persona.code} should mark the result as special`);
  }
});

test('computeResult keeps DRUNK precedence and the documented hidden-persona branch order', () => {
  const harness = createHiddenResultHarness();
  for (const question of harness.questions) {
    harness.answersById[question.id] = 2;
  }

  Object.assign(harness.answersById, {
    q31: 1,
    q32: 3,
    q37: 1,
    q43: 3,
    q44: 1,
    q50: 1
  });

  harness.setDrunk(false);
  const overlapResult = harness.computeResult();
  assert.equal(overlapResult.finalType.code, 'SEEN-ZEN', 'earlier hidden branch should win when multiple hidden personas overlap');
  assert.equal(overlapResult.secondaryType.code, 'TEST', 'overlap branch should still preserve the best normal secondary type');

  harness.setDrunk(true);
  const drunkResult = harness.computeResult();
  assert.equal(drunkResult.finalType.code, 'DRUNK', 'DRUNK should outrank hidden personas');
  assert.equal(drunkResult.secondaryType.code, 'TEST', 'DRUNK should still preserve the best normal secondary type');
  assert.equal(drunkResult.modeKicker, '隐藏人格已激活', 'DRUNK should keep the hidden persona kicker');
});
