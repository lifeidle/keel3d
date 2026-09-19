import { test } from 'node:test';
import assert from 'assert/strict';
import { ThresholdGate } from '../src/blocks/gameplay/ThresholdGate';

/**
 * ThresholdGate — edge-triggered threshold with hysteresis re-arm.
 */

test('fires exactly once on the falling edge; latched while low', () => {
  const g = new ThresholdGate(30);
  assert.equal(g.sample(40), false, 'above: no fire');
  assert.equal(g.sample(29), true, 'below: fires');
  assert.equal(g.latched, true);
  assert.equal(g.sample(20), false, 'latched: no re-fire');
  assert.equal(g.sample(0), false, 'still latched at 0');
});

test('re-arms only above threshold + margin (hysteresis)', () => {
  const g = new ThresholdGate(30, 10);
  assert.equal(g.sample(29), true, 'fire');
  assert.equal(g.sample(35), false, '35 < 40: still latched');
  assert.equal(g.latched, true);
  assert.equal(g.sample(39), false, '39 < 40: still latched');
  assert.equal(g.sample(40), false, '40 = threshold+margin: re-arm (no fire)');
  assert.equal(g.latched, false, 're-armed');
  assert.equal(g.sample(25), true, 'can fire again');
});

test('margin 0: re-arms at exactly the threshold', () => {
  const g = new ThresholdGate(30);
  assert.equal(g.sample(29), true, 'fire');
  assert.equal(g.sample(30), false, '>= threshold: re-arm');
  assert.equal(g.sample(29), true, 'fires again');
});

test('recovery above threshold but below threshold+margin does not re-arm', () => {
  const g = new ThresholdGate(50, 20);
  g.sample(49); // latch
  g.sample(60); // 60 < 70: no re-arm
  assert.equal(g.latched, true);
  g.sample(70); // 70 = 50+20: re-arm
  assert.equal(g.latched, false);
});

test('reset re-arms even while latched', () => {
  const g = new ThresholdGate(30, 5);
  g.sample(10);
  assert.equal(g.latched, true);
  g.reset();
  assert.equal(g.latched, false);
  assert.equal(g.sample(20), true, 'fires after reset');
});

test('invalid config throws', () => {
  assert.throws(() => new ThresholdGate(-1));
  assert.throws(() => new ThresholdGate(NaN));
  assert.throws(() => new ThresholdGate(1, -0.5));
  assert.throws(() => new ThresholdGate(1, Infinity));
});
