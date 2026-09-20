import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBest } from '../src/blocks/combat/TargetPriority';

/**
 * R97 — pickBest (lowest score wins; ties → earlier index; Infinity skips).
 */

test('lowest score wins', () => {
  const out = pickBest([
    { ref: 'far', score: 40 },
    { ref: 'near', score: 12 },
    { ref: 'mid', score: 22 },
  ]);
  assert.equal(out, 'near');
});

test('ties go to the EARLIER index', () => {
  const out = pickBest([
    { ref: 'second', score: 5 },
    { ref: 'first', score: 5 },
  ]);
  assert.equal(out, 'second', 'index order, not value order');
});

test('empty list and all-ineligible lists → null', () => {
  assert.equal(pickBest([]), null);
  assert.equal(
    pickBest([{ ref: 'a', score: Infinity }, { ref: 'b', score: NaN }]),
    null,
    'Infinity/NaN are ineligible',
  );
});

test('a single finite candidate always wins', () => {
  assert.equal(pickBest([{ ref: 'only', score: 999 }]), 'only');
});

test('mixed eligible/ineligible picks the eligible one', () => {
  const out = pickBest([
    { ref: 'dead', score: Infinity },
    { ref: 'alive', score: 30 },
    { ref: 'far-dead', score: NaN },
  ]);
  assert.equal(out, 'alive');
});
