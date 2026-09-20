import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneMultiplier, type DamageZone } from '../src/blocks/combat/HitZone';

/**
 * R98 — zoneMultiplier (AABB containment → multiplier, first wins).
 */

const TURRET: DamageZone = { x: 0, y: 1, z: 0, hx: 1.3, hy: 1.1, hz: 1.3, mul: 1.5 };
const HULL: DamageZone = { x: 0, y: 0.8, z: 0, hx: 2.2, hy: 0.9, hz: 3.5, mul: 1 };

test('inside the turret zone → 1.5×', () => {
  assert.equal(zoneMultiplier(0.4, 1.2, -0.5, [TURRET, HULL]), 1.5);
});

test('outside all zones → 1×', () => {
  assert.equal(zoneMultiplier(5, 0, 5, [TURRET, HULL]), 1);
  assert.equal(zoneMultiplier(0, 0, 0, []), 1, 'empty zone list');
});

test('the FIRST containing zone wins (priority = array order)', () => {
  // the point (0, 0.8, 0) is inside BOTH boxes
  assert.equal(zoneMultiplier(0, 0.8, 0, [TURRET, HULL]), 1.5, 'turret first');
  assert.equal(zoneMultiplier(0, 0.8, 0, [HULL, TURRET]), 1, 'hull first');
});

test('boundaries are inclusive (a hit on the face counts)', () => {
  assert.equal(zoneMultiplier(1.3, 1, 0, [TURRET]), 1.5, 'east face');
  assert.equal(zoneMultiplier(-1.3, 1, 0, [TURRET]), 1.5, 'west face');
  assert.equal(zoneMultiplier(0, 2.1, 0, [TURRET]), 1.5, 'top face');
  assert.equal(zoneMultiplier(0, 2.11, 0, [TURRET]), 1, 'just above');
});

test('validation: finite hit point', () => {
  assert.throws(() => zoneMultiplier(NaN, 0, 0, [TURRET]), /finite/);
});
