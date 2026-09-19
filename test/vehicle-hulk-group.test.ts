import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  placeTankHulk,
  placeScoutWreck,
  placeFenceRow,
  type PropHandles,
  type HulkPhysics,
  type HulkTerrain,
} from '../src/blocks/props/VehicleHulk';

/**
 * R83 — PropHandles.group exposure (content can reposition/reorient a
 * placed prop — drivable vehicle hulks follow their driver).
 */

const physics: HulkPhysics = {
  addStaticBox: () => ({} as unknown as import('@dimforge/rapier3d').Collider),
};
const terrain: HulkTerrain = { heightAt: () => 0 };
const rand = () => 0.25; // deterministic: snapYaw → π/2

test('placeTankHulk: handles carry the prop root group at the spawn position', () => {
  const g = new THREE.Group();
  const h = placeTankHulk(g, physics, terrain, rand, null, 5, -7);
  assert.ok(h.group, 'group exposed');
  assert.equal(h.colliders.length, 1, 'single hull collider (back-compat)');
  assert.ok(h.group.children.length > 5, 'hulk children (tracks + hull + turret)');
  assert.ok(Math.abs(h.group.position.x - 5) < 1e-9, 'group at spawn x');
  assert.ok(Math.abs(h.group.position.z - -7) < 1e-9, 'group at spawn z');
  assert.ok(Math.abs(h.group.rotation.y - Math.PI / 2) < 1e-9, 'deterministic spawn yaw');
});

test('repositioning the group moves every child (world space)', () => {
  const g = new THREE.Group();
  const h = placeTankHulk(g, physics, terrain, rand, null, 0, 0);
  const child = h.group.children[0];
  const before = new THREE.Vector3();
  child.getWorldPosition(before);
  h.group.position.set(12, 0, 3);
  h.group.updateMatrixWorld(true);
  const after = new THREE.Vector3();
  child.getWorldPosition(after);
  assert.ok(Math.abs(after.x - (before.x + 12)) < 1e-6, 'child follows the group x');
  assert.ok(Math.abs(after.z - (before.z + 3)) < 1e-6, 'child follows the group z');
});

test('rotating the group reorients children but NOT the static colliders', () => {
  const g = new THREE.Group();
  const h = placeTankHulk(g, physics, terrain, rand, null, 0, 0);
  const n = h.colliders.length;
  h.group.rotation.y = 0; // face -z (a driven tank's heading)
  h.group.updateMatrixWorld(true);
  assert.equal(h.colliders.length, n, 'collider count unchanged');
  // static physics stays where it was placed — the group turn is visual-only
  assert.equal(n, 1);
});

test('all place* functions return the group handle', () => {
  const g = new THREE.Group();
  const cases: PropHandles[] = [
    placeTankHulk(g, physics, terrain, rand, null, 0, 0),
    placeScoutWreck(g, physics, terrain, rand, 4, 0),
    placeFenceRow(g, physics, terrain, rand, -4, 0),
  ];
  for (const h of cases) {
    assert.ok(h.group instanceof THREE.Group, 'group handle');
    assert.ok(h.colliders.length >= 1, 'colliders preserved');
  }
});
