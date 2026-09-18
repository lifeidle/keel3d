import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CooldownGate } from '../src/blocks/audio/CooldownGate';

/**
 * CooldownGate — injected-clock pacing (deterministic, headless).
 */

test('first pass always succeeds and records the time', () => {
  let t = 1000;
  const g = new CooldownGate(() => t);
  assert.ok(g.tryPass('a', 500));
  assert.ok(g.has('a'));
});

test('passes are blocked inside the gap', () => {
  let t = 1000;
  const g = new CooldownGate(() => t);
  assert.ok(g.tryPass('a', 500));
  t = 1200; // +200 < 500
  assert.equal(g.tryPass('a', 500), false);
  t = 1499;
  assert.equal(g.tryPass('a', 500), false);
});

test('passes after the gap elapses (and re-arms the window)', () => {
  let t = 1000;
  const g = new CooldownGate(() => t);
  assert.ok(g.tryPass('a', 500));
  t = 1500; // exactly +500 → allowed
  assert.ok(g.tryPass('a', 500));
  t = 1600; // only +100 after the re-arm
  assert.equal(g.tryPass('a', 500), false);
});

test('keys are independent (windows do not overlap)', () => {
  let t = 1000;
  const g = new CooldownGate(() => t);
  assert.ok(g.tryPass('a', 500)); // a window: 1000 → 1500
  t = 1300;
  assert.ok(g.tryPass('b', 500)); // b window: 1300 → 1800
  t = 1600;
  assert.ok(g.tryPass('a', 500)); // a elapsed (1600 ≥ 1500)
  assert.equal(g.tryPass('b', 500), false); // b still in gap (1600 < 1800)
  t = 1800;
  assert.ok(g.tryPass('b', 500));
});

test('clear(key) re-arms one key; clear() re-arms all', () => {
  let t = 1000;
  const g = new CooldownGate(() => t);
  assert.ok(g.tryPass('a', 500));
  assert.ok(g.tryPass('b', 500));
  t = 1100;
  g.clear('a');
  assert.ok(g.tryPass('a', 500)); // re-armed
  assert.equal(g.tryPass('b', 500), false); // still in gap
  g.clear();
  assert.ok(g.tryPass('b', 500));
});

test('zero gap never blocks', () => {
  const g = new CooldownGate(() => 42);
  assert.ok(g.tryPass('x', 0));
  assert.ok(g.tryPass('x', 0));
});
