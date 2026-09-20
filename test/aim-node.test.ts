import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AimNode } from '../src/blocks/props/AimNode';

/**
 * R89 — AimNode (rate-limited shortest-path yaw seeking).
 */

test('turns at the rate limit, not the whole way', () => {
  const a = new AimNode(1.0, 0);
  a.aimAt(2.0);
  const y1 = a.update(0.5);
  assert.ok(Math.abs(y1 - 0.5) < 1e-9, `half rate (got ${y1})`);
  assert.ok(!a.settled, 'not settled');
  const y2 = a.update(0.5);
  assert.ok(Math.abs(y2 - 1.0) < 1e-9, `keeps turning (got ${y2})`);
});

test('a big dt reaches the target exactly', () => {
  const a = new AimNode(2.5, 0.4);
  a.aimAt(1.1);
  const y = a.update(10);
  assert.ok(Math.abs(y - 1.1) < 1e-9, `arrives (got ${y})`);
  assert.ok(a.settled, 'settled');
  // zero dt is a no-op
  assert.ok(Math.abs(a.update(0) - 1.1) < 1e-9, 'dt 0 no-op');
});

test('takes the SHORTEST path across the ±π wrap', () => {
  const a = new AimNode(5, 3.0);
  a.aimAt(-3.0); // distance wraps: 2π - 6 ≈ 0.283 (NOT 6)
  const y = a.update(1);
  // 0.283 rad needed, 5 available → arrives at -3.0 (normalized)
  assert.ok(Math.abs(y - (-3.0)) < 0.05, `short way (got ${y})`);
  assert.ok(a.settled, 'settled at wrap target');
});

test('turns the other way for negative targets; reset rewinds', () => {
  const a = new AimNode(4, 1.0);
  a.aimAt(0);
  const y = a.update(0.2);
  assert.ok(Math.abs(y - 0.2) < 1e-9, `turns back (got ${y})`);
  a.reset(2.5);
  assert.ok(Math.abs(a.current - 2.5) < 1e-9, 'reset yaw');
  assert.ok(a.settled, 'reset clears the target');
});

test('validation + yaw stays bounded', () => {
  assert.throws(() => new AimNode(0), /rate/);
  assert.throws(() => new AimNode(NaN), /rate/);
  const a = new AimNode(1);
  assert.throws(() => a.update(-1), /dt/);
  assert.throws(() => a.aimAt(NaN), /target/);
  a.aimAt(7); // 7 rad ≡ 7 - 2π ≈ 0.717
  const y = a.update(10);
  assert.ok(Math.abs(y - (7 - 2 * Math.PI)) < 0.05, `bounded (got ${y})`);
});
