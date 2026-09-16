import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QualityController } from '../src/engine/quality/QualityController';

/** Feed n frames of fixed ms. */
const feed = (c: QualityController, ms: number, n: number) => {
  for (let i = 0; i < n; i++) c.sampleFrame(ms);
};

/** Feed bad frames until the tier first changes (or up to max frames). */
const feedUntilTierChange = (c: QualityController, ms: number, max: number) => {
  const start = c.current;
  for (let i = 0; i < max; i++) {
    c.sampleFrame(ms);
    if (c.current !== start) return i + 1;
  }
  return -1;
};

test('sustained bad frames shrink renderScale (existing behavior)', () => {
  const c = new QualityController('high');
  feed(c, 40, 80); // ~3.2s of 25fps
  assert.ok(c.renderScale < 1, `scale shrank (${c.renderScale})`);
  assert.equal(c.current, 'high'); // scale reacts before tier
});

test('scale exhausted + sustained bad → tier drops high→med', () => {
  const c = new QualityController('high');
  feed(c, 50, 45); // scale shrinks to the floor (~2s)
  assert.equal(c.renderScale, 0.7); // scale exhausted
  const frames = feedUntilTierChange(c, 50, 80);
  assert.ok(frames > 0, 'tier changed at some point');
  assert.equal(c.current, 'med'); // first drop goes one tier down
});

test('tier drop chain continues med→low', () => {
  const c = new QualityController('med');
  feed(c, 50, 45);
  const frames = feedUntilTierChange(c, 50, 80);
  assert.ok(frames > 0, 'tier changed at some point');
  assert.equal(c.current, 'low');
});

test('low is the floor — no further drops', () => {
  const c = new QualityController('low');
  feed(c, 80, 400); // long sustained bad at the floor
  assert.equal(c.current, 'low');
  assert.ok(c.renderScale <= 1);
});

test('manual setTier overrides (player can bring it back up)', () => {
  const c = new QualityController('high');
  feed(c, 50, 45);
  feedUntilTierChange(c, 50, 80);
  assert.equal(c.current, 'med');
  c.setTier('high');
  assert.equal(c.current, 'high');
  assert.equal(c.renderScale, 1);
});

test('autoTier: false → tier never changes automatically', () => {
  const c = new QualityController('high', { autoTier: false });
  feed(c, 50, 300);
  assert.equal(c.current, 'high');
  assert.ok(c.renderScale <= 1.0001); // scale still shrinks
});

test('good frames recover scale and never change tier', () => {
  const c = new QualityController('high');
  feed(c, 40, 60); // shrink to the floor
  const dropped = c.renderScale;
  assert.ok(dropped < 1, `scale dropped to ${dropped}`);
  feed(c, 8, 1100); // 8.8s of 125fps — enough for all recovery steps
  assert.equal(c.renderScale, 1); // recovered
  assert.equal(c.current, 'high'); // tier untouched
});
