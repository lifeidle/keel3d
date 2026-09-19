import { test } from 'node:test';
import assert from 'assert/strict';
import { Fuse } from '../src/blocks/combat/Fuse';

/**
 * Fuse — one-shot delay timer (pure, headless).
 */

test('fires exactly once at the delay; progress tracks the countdown', () => {
  const f = new Fuse(1.0);
  f.arm();
  f.update(0.5);
  assert.equal(f.isFired, false);
  assert.ok(Math.abs(f.progress - 0.5) < 1e-9, `progress ${f.progress}`);
  f.update(0.4);
  assert.equal(f.isFired, false, 't=0.9 < 1.0');
  f.update(0.2); // t=1.1 → fires (clamped)
  assert.equal(f.isFired, true);
  assert.equal(f.progress, 1);
  assert.equal(f.remaining, 0);
  f.update(5); // no re-fire
  assert.equal(f.isFired, true);
  assert.equal(f.progress, 1);
});

test('unarmed: update/detonate are no-ops', () => {
  const f = new Fuse(1.0);
  f.update(10);
  assert.equal(f.isFired, false);
  assert.equal(f.progress, 0);
  f.detonate();
  assert.equal(f.isFired, false, 'detonate before arm is a no-op');
});

test('detonate fires early; re-arm resets everything', () => {
  const f = new Fuse(5.0);
  f.arm();
  f.update(1.0);
  f.detonate();
  assert.equal(f.isFired, true, 'early burst');
  assert.equal(f.progress, 1);
  f.detonate(); // idempotent
  f.arm();
  assert.equal(f.isFired, false, 're-arm clears');
  assert.equal(f.progress, 0);
  f.update(5.0);
  assert.equal(f.isFired, true);
});

test('delay 0 fires on the first update; progress is 1, not NaN', () => {
  const f = new Fuse(0);
  assert.equal(f.progress, 0, 'unarmed');
  f.arm();
  assert.equal(f.progress, 1, 'armed zero-delay = immediately hot');
  f.update(0.016);
  assert.equal(f.isFired, true);
  assert.ok(Number.isFinite(f.progress));
});

test('invalid delay throws', () => {
  assert.throws(() => new Fuse(-1));
});
