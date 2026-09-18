import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DistanceTrigger } from '../src/blocks/player/DistanceTrigger';

/**
 * DistanceTrigger — stride-crossing counter (footstep cadence, pure).
 */

test('exact stride crossing fires once and resets the remainder', () => {
  const t = new DistanceTrigger(2.4);
  assert.equal(t.add(2.4), 1);
  assert.ok(t.phase < 1e-9);
});

test('bulk distance crosses multiple strides (floor semantics)', () => {
  const t = new DistanceTrigger(2.4);
  assert.equal(t.add(10), 4); // 10 / 2.4 = 4.166
  assert.ok(Math.abs(t.phase - (0.4 / 2.4)) < 1e-9, `phase ${t.phase}`);
});

test('sub-stride remainders carry over across calls', () => {
  const t = new DistanceTrigger(2.4);
  assert.equal(t.add(1.0), 0);
  assert.equal(t.add(1.3), 0); // accum 2.3 < 2.4 — not there yet
  assert.equal(t.add(0.2), 1); // accum 2.5 → crosses
  assert.ok(Math.abs(t.phase - (0.1 / 2.4)) < 1e-9, `phase ${t.phase}`);
});

test('zero and negative distances are no-ops', () => {
  const t = new DistanceTrigger(2.4);
  assert.equal(t.add(0), 0);
  assert.equal(t.add(-5), 0);
  assert.equal(t.add(NaN), 0);
  t.add(1.0);
  assert.equal(t.add(0), 0);
  assert.ok(Math.abs(t.phase - (1.0 / 2.4)) < 1e-9);
});

test('reset drops the remainder; setStride validates', () => {
  const t = new DistanceTrigger(2.4);
  t.add(10);
  t.reset();
  assert.equal(t.phase, 0);
  t.add(1.0);
  assert.equal(t.add(1.0), 0); // 2.0 < 2.4
  assert.throws(() => t.setStride(0));
  assert.throws(() => t.setStride(NaN));
  t.setStride(1.0);
  assert.equal(t.add(0.5), 2); // accum 2.5, stride 1 → 2 crossed at once
  assert.equal(t.add(0.1), 0); // remainder 0.6 < 1
});

test('invalid strides throw (constructor and setter)', () => {
  assert.throws(() => new DistanceTrigger(0));
  assert.throws(() => new DistanceTrigger(-1));
  assert.throws(() => new DistanceTrigger(Infinity));
});
