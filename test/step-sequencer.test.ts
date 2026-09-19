import { test } from 'node:test';
import assert from 'assert/strict';
import { StepSequencer } from '../src/blocks/audio/StepSequencer';

/**
 * StepSequencer — table-driven phrase with cursor + completion counting.
 */

const STEPS = [
  { name: 'a', at: 0, gain: 0.5 },
  { name: 'b', at: 0.18, gain: 0.5 },
  { name: 'c', at: 0.36, gain: 0.45 },
  { name: 'd', at: 0.58, gain: 0.6 },
];

test('steps fire in order at their offsets; run completes on the last step', () => {
  const seq = new StepSequencer(STEPS);
  assert.equal(seq.playing, false, 'idle at construction');
  seq.start();
  assert.equal(seq.playing, true);
  const got: string[] = [];
  assert.deepEqual(seq.update(0.1).map((s) => s.name), ['a']);
  assert.deepEqual(seq.update(0.18).map((s) => s.name), ['b']);
  assert.deepEqual(seq.update(0.17).map((s) => s.name), ['c']);
  assert.deepEqual(seq.update(0.22).map((s) => s.name), ['d']);
  assert.equal(seq.playing, false, 'run over');
  assert.equal(seq.runsCompleted, 1);
  got.push(...seq.update(10)); // idle: nothing
  assert.deepEqual(got, []);
});

test('a large dt catches up through several steps in one frame, in order', () => {
  const fired: string[] = [];
  const seq = new StepSequencer(STEPS, (s) => fired.push(s.name));
  seq.start();
  seq.update(2.0); // all four fire in one frame
  assert.deepEqual(fired, ['a', 'b', 'c', 'd'], 'order preserved');
  assert.equal(seq.runsCompleted, 1, 'one run, one count');
});

test('restart resets the cursor; runs accumulate', () => {
  const seq = new StepSequencer(STEPS);
  seq.start();
  seq.update(1.0); // completes run 1
  seq.start(); // restart mid-idle
  assert.equal(seq.playing, true);
  seq.update(0.1); // only step a
  assert.equal(seq.runsCompleted, 1, 'second run not yet complete');
  seq.update(1.0);
  assert.equal(seq.runsCompleted, 2);
});

test('onStep callback receives each fired step (payload passthrough)', () => {
  const seen: { name: string; gain: number; rate: number }[] = [];
  const seq = new StepSequencer(
    [
      { name: 'x', at: 0, gain: 0.7, rate: 0.9 },
      { name: 'y', at: 1, gain: 0.3 },
    ],
    (s) => seen.push({ name: s.name, gain: s.gain ?? 1, rate: s.rate ?? 1 }),
  );
  seq.start();
  seq.update(2);
  assert.deepEqual(seen, [
    { name: 'x', gain: 0.7, rate: 0.9 },
    { name: 'y', gain: 0.3, rate: 1 },
  ]);
});

test('invalid tables throw (empty, negative `at`, decreasing order)', () => {
  assert.throws(() => new StepSequencer([]));
  assert.throws(() => new StepSequencer([{ name: 'a', at: -1 }]));
  assert.throws(() =>
    new StepSequencer([
      { name: 'a', at: 1 },
      { name: 'b', at: 0.5 },
    ]),
  );
});

// R68：generic key — the step `name` flows as the content's key union, so a
// table typo is a compile error, not a silent runtime miss.
const JINGLE_KEYS = { win: true, pickup: true, hit: true, lose: true } as const;
type JingleKey = (typeof JINGLE_KEYS)[keyof typeof JINGLE_KEYS];

const TYPED_STEPS: readonly {
  name: JingleKey;
  at: number;
  gain: number;
  rate: number;
}[] = [
  { name: 'lose', at: 0, gain: 0.5, rate: 0.55 },
  { name: 'hit', at: 0.2, gain: 0.35, rate: 0.45 },
  { name: 'lose', at: 0.4, gain: 0.45, rate: 0.38 },
  { name: 'hit', at: 0.6, gain: 0.5, rate: 0.3 },
];

test('generic key: typed table + callback receive the key union (runtime unchanged)', () => {
  const seq = new StepSequencer<JingleKey>(TYPED_STEPS);
  const seen: JingleKey[] = [];
  const cb = (s: { name: JingleKey }) => {
    seen.push(s.name);
  };
  // callback wiring: re-run through a second instance to prove the type flows
  const seq2 = new StepSequencer<JingleKey>(TYPED_STEPS, cb);
  seq.start();
  seq2.start();
  assert.deepEqual(seq.update(2.0).map((s) => s.name), ['lose', 'hit', 'lose', 'hit']);
  assert.deepEqual(seq2.update(2.0).map((s) => s.name), ['lose', 'hit', 'lose', 'hit']);
  assert.deepEqual(seen, ['lose', 'hit', 'lose', 'hit']);
  assert.equal(seq.runsCompleted, 1);
  assert.equal(seq2.runsCompleted, 1);
});
