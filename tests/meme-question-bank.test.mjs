import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(rootDir, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

function parseQuestions(source) {
  const match = source.match(/const questions = \[([\s\S]*?)\r?\n\s*\];\r?\n\s*const specialQuestions = \[/);
  assert.ok(match, 'questions array should exist in index.html');
  return Function(`return ([${match[1]}\n]);`)();
}

test('regular question bank expands to 50 questions with the approved distribution', () => {
  const questions = parseQuestions(html);

  assert.equal(questions.length, 50, 'expected 50 regular questions');

  const counts = questions.reduce((acc, question) => {
    acc[question.dim] = (acc[question.dim] || 0) + 1;
    return acc;
  }, {});

  assert.deepEqual(counts, {
    S1: 3,
    S2: 4,
    S3: 3,
    E1: 3,
    E2: 3,
    E3: 3,
    A1: 4,
    A2: 3,
    A3: 3,
    Ac1: 3,
    Ac2: 3,
    Ac3: 4,
    So1: 4,
    So2: 3,
    So3: 4,
  });
});

test('q31 through q50 map to the approved meme dimensions', () => {
  const questions = parseQuestions(html);
  const byId = new Map(questions.map((question) => [question.id, question.dim]));

  assert.deepEqual(Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => {
      const id = `q${31 + index}`;
      return [id, byId.get(id)];
    })
  ), {
    q31: 'So1',
    q32: 'So3',
    q33: 'Ac3',
    q34: 'E1',
    q35: 'E3',
    q36: 'A1',
    q37: 'S1',
    q38: 'S2',
    q39: 'A2',
    q40: 'Ac2',
    q41: 'A3',
    q42: 'Ac1',
    q43: 'So2',
    q44: 'So1',
    q45: 'So3',
    q46: 'E2',
    q47: 'S3',
    q48: 'A1',
    q49: 'Ac3',
    q50: 'S2',
  });
});
