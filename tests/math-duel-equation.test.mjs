import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../shared/equation-witness.js', import.meta.url), 'utf8');
const context = {};
context.self = context;
vm.createContext(context);
vm.runInContext(source, context);
const solver = context.MathDuelEquation;

const card = (id, val) => ({ id, val, color: 'b' });

test('keeps the target card order that produces the result', () => {
  const result = solver.checkEquation(
    [card('h1', 1), card('h2', 2), card('h3', 3)],
    '+',
    [card('t5', 5), card('t1', 1)]
  );

  assert.equal(result.eq, '12 + 3 = 15');
  assert.deepEqual(Array.from(result.left.cardIds), ['h1', 'h2']);
  assert.deepEqual(Array.from(result.right.cardIds), ['h3']);
  assert.deepEqual(Array.from(result.target.cardIds), ['t1', 't5']);
  assert.deepEqual(Array.from(result.target.digits), [1, 5]);
});

test('records 6/9 alternate readings in the witness', () => {
  const result = solver.checkEquation([card('h3', 3), card('h3b', 3)], '+', [card('t9', 9)]);

  assert.equal(result.eq, '3 + 3 = 6');
  assert.deepEqual(Array.from(result.target.digits), [6]);
  assert.equal(result.target.hasAlternateDigit, true);
});

test('preserves the split between one-digit and two-digit operands', () => {
  const result = solver.checkEquation(
    [card('h1', 1), card('h2', 2), card('h3', 3)],
    '+',
    [card('t2', 2), card('t4', 4)]
  );

  assert.equal(result.eq, '1 + 23 = 24');
  assert.deepEqual(Array.from(result.left.digits), [1]);
  assert.deepEqual(Array.from(result.right.digits), [2, 3]);
  assert.deepEqual(Array.from(result.target.digits), [2, 4]);
});
