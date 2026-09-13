import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { generateMap, clearMap } from '../src/world/mapgen';
import { PhysicsWorld } from '../src/physics/world';

// Rapier's WASM must be initialised before any World/collider is created.
await RAPIER.init();

const audioStub = {} as unknown as import('../src/audio/audio').Audio;

test('same seed -> identical obstacle layout and spawn count', () => {
  const phys = new PhysicsWorld();
  const a = generateMap(new THREE.Scene(), phys, audioStub, 4242);
  const b = generateMap(new THREE.Scene(), phys, audioStub, 4242);
  assert.deepEqual(a.obstacles, b.obstacles);
  assert.equal(a.spawnPoints.length, b.spawnPoints.length);
  assert.equal(a.seed, b.seed);
  clearMap(new THREE.Scene(), phys, a);
  clearMap(new THREE.Scene(), phys, b);
});

test('different seeds -> different layout', () => {
  const phys = new PhysicsWorld();
  const a = generateMap(new THREE.Scene(), phys, audioStub, 1);
  const b = generateMap(new THREE.Scene(), phys, audioStub, 2);
  assert.notDeepEqual(a.obstacles, b.obstacles);
  clearMap(new THREE.Scene(), phys, a);
  clearMap(new THREE.Scene(), phys, b);
});

test('obstacle + spawn counts stay within sane bounds', () => {
  const phys = new PhysicsWorld();
  const m = generateMap(new THREE.Scene(), phys, audioStub, 555);
  assert.ok(m.obstacles.length > 0, 'should place some cover');
  assert.ok(m.spawnPoints.length >= 1, 'should have at least one spawn');
  assert.ok(m.spawnPoints.length <= 32, 'spawn count should be bounded');
  clearMap(new THREE.Scene(), phys, m);
});
