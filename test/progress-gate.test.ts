import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProgressGate } from '../src/blocks/gameplay/ProgressGate';

/**
 * R96 — ProgressGate (hold-to-progress, release = cancel, one completion edge).
 */

test('held to completion → completion edge fires exactly once', () => {
  const g = new ProgressGate(1.0);
  assert.equal(g.update(0.5, true), false, 'halfway — no edge');
  assert.equal(g.ratio, 0.5, `ratio 0.5 (got ${g.ratio})`);
  assert.equal(g.update(0.5, true), true, 'edge on completion');
  assert.equal(g.ratio, 0, 'idle after firing');
  assert.equal(g.update(1, true), false, 'no re-fire after completion');
});

test('release mid-progress cancels (ratio resets to 0)', () => {
  const g = new ProgressGate(1.0);
  g.update(0.3, true);
  assert.equal(g.inProgress, true, 'in progress');
  assert.ok(Math.abs(g.ratio - 0.3) < 1e-9, `ratio 0.3 (got ${g.ratio})`);
  assert.equal(g.update(0.1, false), false, 'release — no edge');
  assert.equal(g.ratio, 0, 'cancelled');
  assert.equal(g.inProgress, false, 'idle');
});

test('interrupted holds do NOT double-count (fresh hold restarts)', () => {
  const g = new ProgressGate(1.0);
  g.update(0.2, true);
  g.update(0.05, false); // cancel
  g.update(0.2, true); // fresh hold → progress 0.2 again
  assert.ok(Math.abs(g.ratio - 0.2) < 1e-9, `restarts at 0.2 (got ${g.ratio})`);
});

test('cancel() aborts; the next hold starts clean', () => {
  const g = new ProgressGate(1.0);
  g.update(0.5, true);
  g.cancel();
  assert.equal(g.ratio, 0, 'cancelled');
  g.update(1.0, true);
  assert.equal(g.ratio, 0, 'fresh hold after cancel completes cleanly');
});

test('validation: duration and dt', () => {
  assert.throws(() => new ProgressGate(0), /duration/);
  assert.throws(() => new ProgressGate(NaN), /duration/);
  const g = new ProgressGate(1);
  assert.throws(() => g.update(-0.1, true), /dt/);
  assert.throws(() => g.update(NaN, true), /dt/);
  // dt = 0 is legal (no progress)
  assert.equal(g.update(0, true), false, 'zero dt — no progress');
});
