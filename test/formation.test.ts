import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vFormation } from '../src/blocks/ai/Formation';

/**
 * R99 — vFormation (V/wedge slots by index behind the leader, yaw-rotated).
 */

test('n = 0 → empty; n = 1 → single slot at the first flank', () => {
  assert.equal(vFormation(0, 0, 0, 0).length, 0);
  const one = vFormation(0, 0, 0, 1);
  // heading 0: rear = +Z, lateral +X (side +1)
  assert.ok(Math.abs(one[0].x - 1.6) < 1e-9, `x = +spread (got ${one[0].x})`);
  assert.ok(Math.abs(one[0].z - 2.2) < 1e-9, `z = back (got ${one[0].z})`);
});

test('row 0 is a mirror pair (symmetric across the rear axis)', () => {
  const s = vFormation(0, 0, 0, 2);
  assert.ok(Math.abs(s[0].x + s[1].x) < 1e-9, 'x mirrored (±1.6)');
  assert.ok(Math.abs(s[0].z - s[1].z) < 1e-9, 'same row depth');
  assert.ok(Math.abs(s[0].x - 1.6) < 1e-9 && Math.abs(s[1].x + 1.6) < 1e-9,
    `flanks at ±spread (got ${s[0].x}, ${s[1].x})`);
});

test('heading rotates the whole wedge', () => {
  const a = vFormation(0, 0, 0, 3);
  const b = vFormation(0, 0, Math.PI / 2, 3);
  // rotating by π/2 maps (x, z) → (z, −x) for a heading of +π/2
  // (forward −(sin h, cos h): h=0 → (0,−1); h=π/2 → (−1,0))
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(b[i].x - a[i].z) < 1e-9, `slot ${i} x (got ${b[i].x}, want ${a[i].z})`);
    assert.ok(Math.abs(b[i].z + a[i].x) < 1e-9, `slot ${i} z (got ${b[i].z}, want −${a[i].x})`);
  }
});

test('deeper rows sit farther back', () => {
  const s = vFormation(0, 0, 0, 4);
  // rows: i0,i1 → 2.2; i2,i3 → 4.0
  assert.ok(s[2].z > s[0].z, `row 1 behind row 0 (${s[2].z} > ${s[0].z})`);
  assert.ok(Math.abs(s[2].z - (2.2 + 1.8)) < 1e-9, 'rowStep applied');
});

test('validation', () => {
  assert.throws(() => vFormation(NaN, 0, 0, 1), /finite/);
  assert.throws(() => vFormation(0, 0, 0, -1), /non-negative/);
  assert.throws(() => vFormation(0, 0, 0, 1.5), /non-negative/);
  assert.throws(() => vFormation(0, 0, 0, 1, { spread: -1 }), />= 0/);
});
