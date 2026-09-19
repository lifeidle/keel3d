import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Magazine } from '../src/blocks/combat/Magazine';
import { Arsenal } from '../src/blocks/combat/Arsenal';

/**
 * Magazine/Arsenal reload progress (R75 — reload bar + "X.Xs" readouts).
 * reloadRemaining / reloadProgress expose the private reload timer.
 */

test('progress 0 at start → 0.5 mid → completion refills and drops to 0', () => {
  const m = new Magazine(30, 5, 40);
  assert.equal(m.reloadRemaining, 0, 'idle');
  assert.equal(m.reloadProgress, 0, 'idle progress 0');
  m.startReload(1.6);
  assert.equal(m.reloading, true);
  assert.ok(Math.abs(m.reloadRemaining - 1.6) < 1e-9);
  assert.equal(m.reloadProgress, 0, 'fresh reload = 0');
  m.tick(0.8);
  assert.ok(Math.abs(m.reloadRemaining - 0.8) < 1e-9, '0.8s left');
  assert.ok(Math.abs(m.reloadProgress - 0.5) < 1e-9, 'halfway');
  m.tick(0.9); // past completion
  assert.equal(m.reloading, false, 'completed');
  assert.equal(m.rounds, 30, 'mag refilled');
  assert.equal(m.reserve, 15, 'reserve deducted 25 (40 → 15)');
  assert.equal(m.reloadRemaining, 0);
  assert.equal(m.reloadProgress, 0, 'back to idle');
});

test('cancelReload resets progress and remaining', () => {
  const m = new Magazine(30, 5, 40);
  m.startReload(1.6);
  m.tick(0.8);
  m.cancelReload();
  assert.equal(m.reloading, false);
  assert.equal(m.reloadRemaining, 0);
  assert.equal(m.reloadProgress, 0);
});

test('Arsenal mirrors the active slot progress (per-slot isolation)', () => {
  const a = new Arsenal([
    { key: 'r', magSize: 30, reserve: 90, reloadTime: 1.6, fireRate: 6, auto: true },
    { key: 's', magSize: 40, reserve: 120, reloadTime: 2.2, fireRate: 11, auto: true },
  ]);
  a.reload(); // active slot r: full mag → startReload is a no-op
  assert.equal(a.reloadProgress, 0, 'full mag: no reload started');
  // drain the active mag via 30 triggered update() calls (each dt=1/6
  // clears the 1/6s fire cooldown → one shot per call)
  for (let i = 0; i < 30; i++) a.update(1 / 6, true, false);
  // 30th shot fires at cooldown pace; ensure the mag is empty now
  const before = a.mag;
  if (before > 0) {
    // drain remainder (cooldowns may have gated some shots)
    for (let i = 0; i < before; i++) a.update(0.2, true, false);
  }
  assert.equal(a.mag, 0, 'mag drained');
  const out = a.update(0.2, true, false); // empty + reserve > 0 → auto reload
  assert.equal(out, 'empty', 'auto-reload triggered');
  assert.equal(a.reloading, true);
  a.update(0.2, false, false); // advance the reload timer
  const p = a.reloadProgress;
  assert.ok(p > 0 && p < 1, `progress in flight (got ${p})`);
  const rem = a.reloadRemaining;
  assert.ok(rem > 0 && rem <= 1.6, `remaining bounded (got ${rem})`);
  a.switchTo(1);
  assert.equal(a.reloadProgress, 0, 'other slot is idle');
  assert.equal(a.reloadRemaining, 0);
});

test('progress stays clamped when ticked past zero (no negatives)', () => {
  const m = new Magazine(10, 2, 20);
  m.startReload(1);
  m.tick(5); // over-tick
  assert.equal(m.reloading, false);
  assert.equal(m.reloadProgress, 0);
  assert.equal(m.reloadRemaining, 0);
});
