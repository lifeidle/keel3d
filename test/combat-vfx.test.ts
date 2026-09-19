import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CombatVfx } from '../src/blocks/fx/CombatVfx';

/**
 * CombatVfx — R74: explosion intensity (first tests for this block).
 * Counts are deterministic at a given intensity (randomness only affects
 * position/colour): 1 → 24 effects (1 fire + 5 smoke + 18 sparks),
 * 2 → 45 (1 + 8 + 36).
 */

test('explosion defaults to intensity 1: 24 active effects (backward compatible)', () => {
  const v = new CombatVfx();
  v.explosion(new THREE.Vector3(0, 0, 0)); // bare call = original behaviour
  assert.equal(v.count(), 24, '1 fire + 5 smoke + 18 sparks');
});

test('explosion intensity 2 (vehicle-class): 45 active effects', () => {
  const v = new CombatVfx();
  v.explosion(new THREE.Vector3(0, 0, 0), 2);
  assert.equal(v.count(), 45, '1 fire + 8 smoke + 36 sparks');
});

test('effects expire: update(dt) drains the active list', () => {
  const v = new CombatVfx();
  v.explosion(new THREE.Vector3(0, 0, 0), 2);
  assert.equal(v.count(), 45);
  v.update(5); // all lives < 5s
  assert.equal(v.count(), 0, 'all expired');
});

test('counts are deterministic regardless of call order', () => {
  const v = new CombatVfx();
  v.explosion(new THREE.Vector3(1, 0, 0));
  assert.equal(v.count(), 24);
  v.update(5);
  v.explosion(new THREE.Vector3(2, 0, 0), 2);
  assert.equal(v.count(), 45, 'pools refill after expiry');
  v.update(5);
  assert.equal(v.count(), 0);
});
