import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestPoint } from '../src/blocks/combat/Nearest';

/**
 * R92 — nearestPoint (true-nearest within radius; ties → earlier index).
 */

test('true NEAREST wins, not first-in-array', () => {
  const pts = [{ x: 10, z: 0 }, { x: 0.5, z: 0.5 }];
  const i = nearestPoint(0, 0, pts, 100);
  assert.equal(i, 1, `second point is closer (got ${i})`);
});

test('points beyond maxDist are rejected (inclusive threshold)', () => {
  const pts = [{ x: 5, z: 0 }, { x: 3, z: 4 }]; // dists 5 and 5
  assert.equal(nearestPoint(0, 0, pts, 4.999), -1, 'both beyond — none');
  assert.equal(nearestPoint(0, 0, pts, 5), 0, 'exactly at maxDist — accepted');
  assert.equal(nearestPoint(0, 0, pts, 5.001), 0, 'just over — accepted');
});

test('ties go to the EARLIER index', () => {
  const pts = [{ x: 3, z: 0 }, { x: 0, z: 3 }, { x: -3, z: 0 }];
  assert.equal(nearestPoint(0, 0, pts, 10), 0, 'first of three equidistant');
  const pts2 = [{ x: 3, z: 0 }, { x: -3, z: 0 }];
  assert.equal(nearestPoint(0, 0, pts2, 10), 0, 'tie → index 0');
});

test('empty and trivial cases', () => {
  assert.equal(nearestPoint(0, 0, [], 10), -1, 'empty → −1');
  assert.equal(nearestPoint(2, 3, [{ x: 2, z: 3 }], 0), 0, 'zero distance at zero maxDist');
  assert.equal(nearestPoint(2, 3, [{ x: 2, z: 3 }, { x: 9, z: 9 }], 10), 0, 'closer wins');
});

test('validation', () => {
  assert.throws(() => nearestPoint(NaN, 0, [], 1), /px\/pz/);
  assert.throws(() => nearestPoint(0, 0, [], NaN), /maxDist/);
  assert.throws(() => nearestPoint(0, 0, [], -1), /maxDist/);
  assert.throws(() => nearestPoint(0, 0, [{ x: NaN, z: 0 }], 1), /point/);
});
