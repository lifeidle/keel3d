import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  duckGain,
  distanceGain,
  eventGain,
  DEFAULT_AUDIO_DUCK,
} from '../src/blocks/audio/AudioDuck';

test('duckGain: no ducking at or under the limit', () => {
  assert.equal(duckGain(0), 1);
  assert.equal(duckGain(4), 1);
});

test('duckGain: decays proportionally over the limit', () => {
  // active=8 → 0.55 × 4/8 = 0.275 → clamped to floor 0.3
  assert.equal(duckGain(6), (0.55 * 4) / 6);
  assert.ok(Math.abs(duckGain(8) - 0.3) < 0.001); // clamped
});

test('duckGain: never below the floor', () => {
  assert.ok(duckGain(1000) >= DEFAULT_AUDIO_DUCK.duckFloor);
  assert.equal(duckGain(1000), 0.3);
});

test('distanceGain: 1 near, floor far, linear monotonic between', () => {
  assert.equal(distanceGain(0), 1);
  assert.equal(distanceGain(4), 1); // at minDist
  assert.equal(distanceGain(40), 0.08); // at maxDist
  assert.equal(distanceGain(100), 0.08); // beyond maxDist
  const mids = [5, 10, 15, 20, 25, 30, 35].map((d) => distanceGain(d));
  for (let i = 1; i < mids.length; i++) {
    assert.ok(mids[i] < mids[i - 1], `monotonic decreasing at ${10 + (i - 1) * 5}`);
  }
  // linear: midpoint of [4,40] → midpoint of [0.08, 1]
  assert.ok(Math.abs(distanceGain(22) - 0.54) < 0.001);
});

test('eventGain: product of distance and duck', () => {
  assert.equal(eventGain(0, 0), 1);
  assert.equal(eventGain(40, 0), 0.08);
  assert.ok(Math.abs(eventGain(40, 8) - 0.08 * 0.3) < 0.0001);
  assert.equal(eventGain(0, 100), 0.3);
});

test('custom config is honored (tighter range)', () => {
  const cfg = { maxEvents: 2, duckMul: 0.4, duckFloor: 0.2, minDist: 2, maxDist: 20, minGain: 0.1 };
  assert.equal(duckGain(2, cfg), 1);
  assert.equal(duckGain(4, cfg), 0.2); // 0.4×2/4 = 0.2 exactly at floor
  assert.equal(distanceGain(20, cfg), 0.1);
  assert.equal(distanceGain(11, cfg), 0.55); // midpoint
});
