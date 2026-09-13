import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blastFalloff } from '../src/world/ballistics';

test('blastFalloff: full damage at the centre', () => {
  assert.equal(blastFalloff(0, 9, 0.15), 1);
});

test('blastFalloff: tapers to edgeFrac at the radius', () => {
  assert.ok(Math.abs(blastFalloff(9, 9, 0.15) - 0.15) < 1e-9);
});

test('blastFalloff: zero beyond the radius', () => {
  assert.equal(blastFalloff(10, 9, 0.15), 0);
  assert.equal(blastFalloff(100, 9, 0.15), 0);
});

test('blastFalloff: linear and monotonic between centre and edge', () => {
  // 0.5R should be half the drop from 1 to edgeFrac
  const mid = blastFalloff(4.5, 9, 0.15);
  assert.ok(Math.abs(mid - (1 + 0.15) / 2) < 1e-9, `mid=${mid}`);
  assert.ok(blastFalloff(2, 9, 0.15) > blastFalloff(6, 9, 0.15));
});
