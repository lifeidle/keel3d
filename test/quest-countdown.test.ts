import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questLine, type QuestItem } from '../src/blocks/ui/QuestTracker';
import {
  ObjectiveTracker,
  objectiveRemaining,
} from '../src/blocks/gameplay/Objective';

/**
 * R77 — quest countdown rendering + objective remaining time.
 */

test('questLine: markers and classic progress pair', () => {
  assert.equal(questLine({ id: 'a', title: 'clear' }), '☐ clear');
  assert.equal(questLine({ id: 'a', title: 'clear', active: true }), '▶ clear');
  assert.equal(
    questLine({ id: 'a', title: 'clear', active: true, progress: [2, 3] }),
    '▶ clear 2/3',
  );
  assert.equal(
    questLine({ id: 'a', title: 'clear', done: true, progress: [3, 3] }),
    '☑ clear',
  );
});

test('questLine: countdown renders time left (clamped at 0)', () => {
  assert.equal(
    questLine({ id: 'h', title: 'holdout', active: true, progress: [4, 15], countdown: true }),
    '▶ holdout 11s',
  );
  // current >= target → 0s (not negative)
  assert.equal(
    questLine({ id: 'h', title: 'holdout', progress: [20, 15], countdown: true }),
    '☐ holdout 0s',
  );
  // done overrides the countdown suffix
  assert.equal(
    questLine({ id: 'h', title: 'holdout', done: true, progress: [15, 15], countdown: true }),
    '☑ holdout',
  );
});

test('objectiveRemaining: ceil of time left, done → 0', () => {
  const t = new ObjectiveTracker();
  t.add('holdout', 'hold 15s', 15, true);
  assert.equal(t.remaining('holdout'), 15, 'untouched = full time');
  t.bump('holdout', 4);
  assert.equal(t.remaining('holdout'), 11, '15 - 4');
  t.bump('holdout', 4.3); // progress 8.3 → 6.7 left → ceil 7
  assert.equal(t.remaining('holdout'), 7, 'ceil of fractional remainder');
  t.bump('holdout', 10); // over target → done
  assert.equal(t.remaining('holdout'), 0, 'done → 0');
  const snap = t.snapshot().find((o) => o.id === 'holdout')!;
  assert.equal(objectiveRemaining(snap), 0, 'snapshot helper agrees');
});

test('objectiveRemaining helper on plain snapshots', () => {
  assert.equal(objectiveRemaining({ id: 'x', label: '', target: 10, progress: 2.4, done: false, active: true }), 8);
  assert.equal(objectiveRemaining({ id: 'x', label: '', target: 10, progress: 0, done: false, active: false }), 10);
  assert.equal(objectiveRemaining({ id: 'x', label: '', target: 10, progress: 10, done: true, active: false }), 0);
});
