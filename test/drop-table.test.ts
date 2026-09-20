import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollDrops } from '../src/blocks/loot/DropTable';

/**
 * R100 — rollDrops (independent per-entry chances, injected rng).
 */

const TABLE = [
  { id: 'ammo', chance: 1.0, min: 1, max: 1 },
  { id: 'mag', chance: 0.5, min: 1, max: 2 },
];

test('chance 1.0 always drops; a later entry can miss on its own roll', () => {
  // rng sequence: [0.2 (ammo chance <1.0), 0.5 (ammo amount → 1),
  // 0.9 (mag chance >= 0.5 → miss)]
  const seq = [0.2, 0.5, 0.9];
  let i = 0;
  const out = rollDrops(TABLE, () => seq[i++]);
  assert.deepEqual(out, [{ id: 'ammo', amount: 1 }]);
});

test('a deterministic sequence gives deterministic amounts', () => {
  const seq = [0.1, 0.4, 0.2, 0.8];
  let i = 0;
  const out = rollDrops(TABLE, () => seq[i++]);
  // ammo: r=0.1 < 1.0 → drop; amount rng=0.4 → 1 + floor(0.4·1) = 1
  // mag:  r=0.2 < 0.5 → drop; amount rng=0.8 → 1 + floor(0.8·2) = 2
  assert.deepEqual(out, [
    { id: 'ammo', amount: 1 },
    { id: 'mag', amount: 2 },
  ]);
});

test('entries drop INDEPENDENTLY (a loot set, not exclusive picks)', () => {
  const out = rollDrops(
    [
      { id: 'a', chance: 1, min: 1, max: 1 },
      { id: 'b', chance: 1, min: 1, max: 1 },
      { id: 'c', chance: 1, min: 2, max: 2 },
    ],
    () => 0, // every check and amount roll returns 0
  );
  assert.deepEqual(out, [
    { id: 'a', amount: 1 },
    { id: 'b', amount: 1 },
    { id: 'c', amount: 2 },
  ]);
});

test('chance 0 entries never roll (and never consume rng)', () => {
  let calls = 0;
  const out = rollDrops(
    [
      { id: 'never', chance: 0, min: 1, max: 3 },
      { id: 'always', chance: 1, min: 1, max: 1 },
    ],
    () => {
      calls++;
      return 0;
    },
  );
  assert.deepEqual(out, [{ id: 'always', amount: 1 }]);
  assert.equal(calls, 2, 'one chance roll + one amount roll for the surviving entry');
});

test('validation', () => {
  assert.throws(() => rollDrops([{ id: '', chance: 1, min: 0, max: 0 }], () => 0), /id/);
  assert.throws(() => rollDrops([{ id: 'a', chance: 1.5, min: 0, max: 0 }], () => 0), /chance/);
  assert.throws(() => rollDrops([{ id: 'a', chance: 1, min: 2, max: 1 }], () => 0), /min\/max/);
  assert.throws(() => rollDrops([{ id: 'a', chance: NaN, min: 0, max: 0 }], () => 0), /chance/);
});
