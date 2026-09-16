import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Streak } from '../src/blocks/gameplay/Streak';

test('hits inside the window accumulate', () => {
  const s = new Streak({ window: 4 });
  assert.equal(s.hit(0), 1);
  assert.equal(s.hit(1), 2);
  assert.equal(s.hit(3.9), 3);
  assert.equal(s.best, 3);
});

test('a gap longer than the window resets the run', () => {
  const s = new Streak({ window: 4 });
  s.hit(0);
  s.hit(1);
  s.update(5.5); // gap 4.5 > 4 from the last hit
  assert.equal(s.count, 0);
  s.hit(6); // fresh run
  assert.equal(s.count, 1);
  assert.equal(s.best, 2);
});

test('thresholds fire exactly once per run', () => {
  const seen: number[] = [];
  const s = new Streak({ window: 10, thresholds: [3], onStreak: (n) => seen.push(n) });
  s.hit(0);
  s.hit(1);
  assert.deepEqual(seen, []);
  s.hit(2);
  assert.deepEqual(seen, [3]);
  s.hit(3); // count 4 — not a threshold, no re-fire
  assert.deepEqual(seen, [3]);
});

test('multiple thresholds fire in order', () => {
  const seen: number[] = [];
  const s = new Streak({ window: 20, thresholds: [3, 5], onStreak: (n) => seen.push(n) });
  for (let i = 0; i < 5; i++) s.hit(i);
  assert.deepEqual(seen, [3, 5]);
});

test('after a reset, thresholds fire again (new run)', () => {
  const seen: number[] = [];
  const s = new Streak({ window: 10, thresholds: [2], onStreak: (n) => seen.push(n) });
  s.hit(0);
  s.hit(1);
  s.update(100); // gap → run reset, fired set cleared
  s.hit(101);
  s.hit(102);
  assert.deepEqual(seen, [2, 2]);
});

test('reset() clears count but keeps best', () => {
  const s = new Streak({ window: 5 });
  s.hit(0);
  s.hit(1);
  s.reset();
  assert.equal(s.count, 0);
  assert.equal(s.best, 2);
});
