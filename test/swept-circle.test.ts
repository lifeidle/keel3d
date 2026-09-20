import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sweptCircle } from '../src/blocks/combat/SweptCircle';

/**
 * R95 — sweptCircle (segment prev→current vs circle).
 */

test('passes through the center → hit at zero distance', () => {
  const h = sweptCircle(-5, 0, 5, 0, 0, 0, 1);
  assert.equal(h.hit, true, 'segment crosses the center');
  assert.ok(h.distance < 1e-9, `center crossed (got ${h.distance})`);
  assert.equal(h.x, 0);
  assert.equal(h.z, 0);
});

test('near miss beyond radius → no hit, distance = offset', () => {
  const h = sweptCircle(-5, 0, 5, 0, 0, 1.5, 1);
  assert.equal(h.hit, false, `offset 1.5 > r 1 (distance ${h.distance})`);
  assert.ok(Math.abs(h.distance - 1.5) < 1e-9, 'exact offset');
});

test('overlap at the START endpoint counts (t clamps to 0)', () => {
  const h = sweptCircle(0.5, 0, 5, 0, 0, 0, 1);
  assert.equal(h.hit, true, 'starts inside the circle');
  assert.ok(Math.abs(h.distance - 0.5) < 1e-9, 'closest point = start');
  assert.equal(h.x, 0.5);
});

test('stationary mover degenerates to a plain distance check', () => {
  const h = sweptCircle(2, 3, 2, 3, 0, 0, 1);
  assert.equal(h.hit, false, 'distance √13 > 1');
  assert.ok(Math.abs(h.distance - Math.sqrt(13)) < 1e-9, 'plain distance');
  const inside = sweptCircle(0.3, 0, 0.3, 0, 0, 0, 1);
  assert.equal(inside.hit, true, 'inside → hit');
  assert.ok(Math.abs(inside.distance - 0.3) < 1e-9, 'distance = 0.3 (mover at 0.3u)');
});

test('validation: finite coordinates, radius >= 0', () => {
  assert.throws(() => sweptCircle(NaN, 0, 1, 0, 0, 0, 1), /finite/);
  assert.throws(() => sweptCircle(0, 0, 1, 0, 0, 0, NaN), /finite/);
  assert.throws(() => sweptCircle(0, 0, 1, 0, 0, 0, -1), /radius/);
  // zero radius is allowed (point test)
  assert.equal(sweptCircle(0, 0, 1, 0, 1, 0, 0).hit, true, 'exact point hit');
});
