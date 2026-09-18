import { test } from 'node:test';
import assert from 'node:assert/strict';
import { climbRatio, slopeFactor } from '../src/blocks/player/Slope';

/**
 * Slope — slope-aware movement helpers (pure, headless).
 */

test('climbRatio: flat = 0, uphill positive, downhill negative', () => {
  const h = (x: number, _z: number) => x * 2; // 2u rise per 1u east
  assert.equal(climbRatio({ x: 0, z: 0 }, { x: 5, z: 0 }, h), 2); // 10/5
  assert.equal(climbRatio({ x: 5, z: 0 }, { x: 0, z: 0 }, h), -2);
  const flat = (_x: number, _z: number) => 3;
  assert.equal(climbRatio({ x: 0, z: 0 }, { x: 9, z: 9 }, flat), 0);
});

test('climbRatio: diagonal distance in the denominator', () => {
  const h = (_x: number, z: number) => z; // 1u rise per 1u north
  // step to (1, 1): rise 1 over hypot(1,1) = 0.7071
  assert.ok(Math.abs(climbRatio({ x: 0, z: 0 }, { x: 1, z: 1 }, h) - (1 / Math.SQRT2)) < 1e-9);
});

test('climbRatio: zero-length step is 0 (no divide)', () => {
  const h = (_x: number, _z: number) => 5;
  assert.equal(climbRatio({ x: 3, z: 3 }, { x: 3, z: 3 }, h), 0);
});

test('slopeFactor: full speed ≤ soft, minFactor ≥ hard, clamped beyond', () => {
  assert.equal(slopeFactor(0, 0.35, 0.8), 1);
  assert.equal(slopeFactor(0.35, 0.35, 0.8), 1);
  assert.equal(slopeFactor(0.8, 0.35, 0.8), 0.35);
  assert.equal(slopeFactor(2.5, 0.35, 0.8), 0.35);
});

test('slopeFactor: linear in between, monotonically decreasing', () => {
  const mid = slopeFactor(0.575, 0.35, 0.8, 0.35); // halfway
  assert.ok(Math.abs(mid - 0.675) < 1e-9, `mid ${mid}`);
  let prev = Infinity;
  for (const c of [0, 0.2, 0.4, 0.6, 0.9, 1.5]) {
    const f = slopeFactor(c, 0.35, 0.8, 0.35);
    assert.ok(f <= prev + 1e-12, `f(${c})=${f} > f(${c - 0.2})=${prev}`);
    prev = f;
  }
});

test('slopeFactor: custom minFactor respected', () => {
  assert.equal(slopeFactor(1.0, 0.3, 0.9, 0.1), 0.1);
  assert.equal(slopeFactor(0.0, 0.3, 0.9, 0.1), 1);
});
