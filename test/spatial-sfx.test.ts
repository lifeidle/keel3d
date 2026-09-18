import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SampleBank,
  panFor,
  panGain,
} from '../src/blocks/audio/SampleBank';

/**
 * Spatial one-shots (R48) — panFor/panGain are pure (headless); playPanned
 * must be a safe no-op without a context.
 */

test('panFor: right of view = +1, left = -1, behind = 0 (facing -z)', () => {
  // listener at origin looking down -z (yexi yaw 0)
  assert.ok(panFor(0, -1, 10, 0, 0, 0) > 0.99); // straight right (+x)
  assert.ok(panFor(0, -1, -10, 0, 0, 0) < -0.99); // straight left
  assert.ok(Math.abs(panFor(0, -1, 0, 10, 0, 0)) < 1e-9); // behind (+z)
});

test('panFor: 45-degree right-rear sits between 0 and +1', () => {
  const p = panFor(0, -1, 10, 10, 0, 0);
  assert.ok(p > 0.6 && p < 0.8, `pan ${p}`);
});

test('panFor: follows the facing direction (facing +x → +z is right)', () => {
  assert.ok(panFor(1, 0, 0, 10, 0, 0) > 0.99); // +z is right of +x-facing
  assert.ok(panFor(1, 0, 0, -10, 0, 0) < -0.99);
});

test('panFor: source at listener position → 0 (degenerate, no divide)', () => {
  assert.equal(panFor(0, -1, 0, 0, 0, 0), 0);
});

test('panGain: 1 inside ref, 0 at/over max, linear between', () => {
  assert.equal(panGain(0, 4, 70), 1);
  assert.equal(panGain(4, 4, 70), 1);
  assert.equal(panGain(70, 4, 70), 0);
  assert.equal(panGain(90, 4, 70), 0);
  const mid = panGain(37, 4, 70); // midpoint of 4..70
  assert.ok(Math.abs(mid - 0.5) < 1e-9, `mid ${mid}`);
});

test('panGain: monotonically decreasing with distance', () => {
  let prev = Infinity;
  for (let d = 0; d <= 70; d += 5) {
    const g = panGain(d, 4, 70);
    assert.ok(g <= prev, `g(${d})=${g} > g(${d - 5})=${prev}`);
    prev = g;
  }
});

test('playPanned without a context is a safe no-op (returns false)', () => {
  const bank = new SampleBank({ shoot: ['kit/shoot.wav'] });
  assert.equal(
    bank.playPanned('shoot', 5, -8, { x: 0, z: -1 }, { x: 0, z: 0 }),
    false,
  );
  assert.equal(bank.playPanned('missing', 5, -8, { x: 0, z: -1 }, { x: 0, z: 0 }), false);
});
