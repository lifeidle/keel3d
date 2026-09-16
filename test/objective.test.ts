import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectiveTracker } from '../src/blocks/gameplay/Objective';

/**
 * ObjectiveTracker — pure data chain tests (no three/DOM/WASM).
 * Sequence gate: only the active objective counts; reaching target
 * auto-completes and fires callbacks exactly once.
 */

test('add/current/activate drive the sequence', () => {
  const t = new ObjectiveTracker();
  t.add('a', 'A', 2, true);
  t.add('b', 'B', 1);
  t.add('c', 'C', 0);
  assert.equal(t.current()?.id, 'a');
  t.activate('b');
  assert.equal(t.current()?.id, 'b', 'activating b makes it the counting one');
  t.activate('c');
  assert.equal(t.current()?.id, 'c');
});

test('bump clamps at target and auto-completes once', () => {
  const t = new ObjectiveTracker();
  t.add('kills', 'kills', 3, true);
  let fired = 0;
  t.onComplete = () => fired++;
  t.bump('kills', 1);
  t.bump('kills', 2);
  assert.equal(t.current(), null, 'completed at exactly target');
  assert.equal(fired, 1, 'onComplete fired once');
  const snap = t.snapshot().find((s) => s.id === 'kills');
  assert.equal(snap?.progress, 3);
  assert.ok(snap?.done);
  // further bumps are no-ops
  t.bump('kills', 5);
  assert.equal(fired, 1);
  assert.equal(snap?.progress, 3, 'progress clamped at target');
});

test('bump is ignored while the objective is inactive (sequence gate)', () => {
  const t = new ObjectiveTracker();
  t.add('a', 'A', 1, true);
  t.add('b', 'B', 1);
  t.bump('b', 1);
  assert.equal(t.snapshot().find((s) => s.id === 'b')?.progress, 0, 'inactive bump ignored');
  t.bump('a', 1);
  t.activate('b');
  t.bump('b', 1);
  assert.equal(t.snapshot().find((s) => s.id === 'b')?.progress, 1);
});

test('flag objectives (target 0) complete via complete(); onAllDone fires last', () => {
  const t = new ObjectiveTracker();
  const order: string[] = [];
  t.add('a', 'A', 1, true);
  t.add('flag', 'F', 0);
  t.onComplete = (o) => order.push(o.id);
  let allDoneFired = false;
  t.onAllDone = () => (allDoneFired = true);
  t.bump('a', 1);
  t.activate('flag');
  t.complete('flag');
  assert.deepEqual(order, ['a', 'flag']);
  assert.ok(allDoneFired);
  assert.ok(t.allDone());
  assert.equal(t.current(), null);
});

test('reset re-arms the first objective', () => {
  const t = new ObjectiveTracker();
  t.add('a', 'A', 1, true);
  t.add('b', 'B', 1);
  t.bump('a', 1);
  t.activate('b');
  t.bump('b', 1);
  assert.ok(t.allDone());
  t.reset();
  assert.equal(t.current()?.id, 'a');
  assert.equal(t.snapshot().find((s) => s.id === 'a')?.progress, 0);
  assert.ok(!t.allDone());
});

test('fractional progress (timers) completes on crossing target', () => {
  const t = new ObjectiveTracker();
  t.add('hold', 'hold 15s', 15, true);
  for (let i = 0; i < 14; i++) t.bump('hold', 1);
  assert.equal(t.current()?.id, 'hold', 'not done at 14');
  t.bump('hold', 0.5);
  assert.equal(t.current()?.id, 'hold'); // 14.5 < 15
  t.bump('hold', 0.5);
  assert.equal(t.current(), null, 'done at exactly 15');
  assert.equal(t.snapshot().find((s) => s.id === 'hold')?.progress, 15);
});

test('duplicate and unknown ids throw', () => {
  const t = new ObjectiveTracker();
  t.add('a', 'A', 1, true);
  assert.throws(() => t.add('a', 'again'));
  assert.throws(() => t.bump('zzz'));
});
