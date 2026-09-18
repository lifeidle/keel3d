import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Linger } from '../src/blocks/gameplay/Linger';

/**
 * Linger — linger-then-fade state machine (pure, headless).
 */

test('alpha stays 1 until the ramp window, then eases linearly to 0', () => {
  const l = new Linger(6, 1.5);
  l.start();
  l.update(3);
  assert.equal(l.alpha, 1, 't=3 ≤ window 4.5');
  assert.equal(l.isActive, true);
  l.update(0.75); // t=3.75
  assert.equal(l.alpha, 1);
  l.update(1); // t=4.75 → (6-4.75)/1.5
  assert.ok(Math.abs(l.alpha - 0.8333333) < 1e-6, `alpha ${l.alpha}`);
  l.update(1); // t=5.75 → 0.1666…
  assert.ok(Math.abs(l.alpha - (0.25 / 1.5)) < 1e-6, `alpha ${l.alpha}`);
});

test('completes at duration (clamped), done flags, alpha 0', () => {
  const l = new Linger(2, 0.5);
  l.start();
  l.update(1.9);
  assert.equal(l.done, false);
  l.update(0.2); // t=2.1 → clamped to 2
  assert.equal(l.done, true);
  assert.equal(l.isActive, false);
  assert.equal(l.alpha, 0);
  l.update(1); // no-op after completion
  assert.equal(l.alpha, 0);
});

test('ramp larger than duration → linear over the whole window', () => {
  const l = new Linger(1, 5); // ramp clamped to 1
  l.start();
  l.update(0.5);
  assert.ok(Math.abs(l.alpha - 0.5) < 1e-9, `alpha ${l.alpha}`);
  l.update(0.5);
  assert.equal(l.done, true);
  assert.equal(l.alpha, 0);
});

test('idle = alpha 0; restart resets to full', () => {
  const l = new Linger(4, 2);
  assert.equal(l.alpha, 0, 'idle before start');
  l.start();
  l.update(4);
  assert.equal(l.alpha, 0, 'after completion');
  l.start();
  assert.equal(l.alpha, 1, 'restart → full strength');
  assert.equal(l.done, false);
});

test('invalid duration throws', () => {
  assert.throws(() => new Linger(0));
  assert.throws(() => new Linger(-1, 1));
});
