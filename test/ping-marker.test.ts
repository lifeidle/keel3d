import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PingMarker } from '../src/blocks/ui/PingMarker';

/**
 * PingMarker — transient map pings (R73).
 */

test('fraction runs 1 → 0 over the life; prunes on expiry', () => {
  const p = new PingMarker();
  p.ping(0, 0, 0, 3);
  assert.equal(p.active(-1).length, 0, 'not active before born');
  assert.deepEqual(p.active(0), [{ x: 0, z: 0, fraction: 1, tag: undefined }], 'full at born');
  assert.ok(Math.abs(p.active(1.5)[0].fraction - 0.5) < 1e-9, 'half at mid-life');
  assert.equal(p.active(3).length, 0, 'pruned at expiry');
  assert.equal(p.size, 0, 'size follows the pruned list');
});

test('multiple pings: per-ping life, oldest first', () => {
  const p = new PingMarker();
  p.ping(-10, 5, 0, 4); // long life
  p.ping(2, -3, 2, 2); // short life, born later
  const at35 = p.active(3.5);
  assert.equal(at35.length, 2);
  assert.ok(Math.abs(at35[0].fraction - 0.125) < 1e-9, 'long ping first (older, lower fraction)');
  assert.ok(Math.abs(at35[1].fraction - 0.25) < 1e-9, 'short ping at 0.25');
  assert.equal(p.active(4.5).length, 0, 'both expired');
});

test('size counts unexpired pings; future-born pings wait for their born time', () => {
  const p = new PingMarker();
  p.ping(0, 0, 0, 3);
  p.ping(1, 1, 1, 3);
  assert.equal(p.size, 2, 'raw count of unexpired pings');
  const early = p.active(0.5);
  assert.equal(early.length, 1, 'second ping (born at 1) not active yet');
  const at1 = p.active(1);
  assert.equal(at1.length, 2, 'both born at t=1');
  assert.deepEqual(at1, p.active(1), 'same snapshot at the same time');
  assert.deepEqual(at1[0], { x: 0, z: 0, fraction: 0.6666666666666667, tag: undefined }, 'first at 2/3');
});

test('invalid life throws', () => {
  const p = new PingMarker();
  assert.throws(() => p.ping(0, 0, 0, 0));
  assert.throws(() => p.ping(0, 0, 0, -1));
  assert.throws(() => p.ping(0, 0, 0, NaN));
  p.ping(0, 0, 0, 3); // default-life path is fine via explicit valid value
  assert.equal(p.size, 1);
});
