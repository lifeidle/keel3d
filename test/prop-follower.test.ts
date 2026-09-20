import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PropFollower } from '../src/blocks/props/PropFollower';

/**
 * R90 — PropFollower (static hulk follows a moving unit).
 */

test('position follows; y is compensated by the base spawn height', () => {
  const g = new THREE.Group();
  const f = new PropFollower(g, 2.0); // hulk authored at ground height 2.0
  const heightAt = (x: number, z: number) => x * 2 + z;
  f.update(3, 4, heightAt);
  assert.equal(g.position.x, 3, 'x follows');
  assert.equal(g.position.z, 4, 'z follows');
  // h(3,4) = 10 → group.y = 10 − 2 = 8 (children keep their authored offsets)
  assert.ok(Math.abs(g.position.y - 8) < 1e-9, `y compensated (got ${g.position.y})`);
});

test('yaw override applies; omitted yaw keeps the current (authored) yaw', () => {
  const g = new THREE.Group();
  g.rotation.y = 1.23; // authored traverse
  const f = new PropFollower(g, 0);
  f.update(1, 1, () => 0); // no yaw → keeps 1.23
  assert.ok(Math.abs(g.rotation.y - 1.23) < 1e-9, 'authored yaw kept');
  f.update(2, 2, () => 0, 0.5);
  assert.ok(Math.abs(g.rotation.y - 0.5) < 1e-9, 'yaw override applies');
});

test('follows a trajectory across frames', () => {
  const g = new THREE.Group();
  const f = new PropFollower(g, 0.5);
  const pts: [number, number][] = [[0, 0], [5, 0], [5, 7]];
  const heightAt = (x: number, z: number) => Math.hypot(x, z) * 0.3;
  for (const [x, z] of pts) f.update(x, z, heightAt, 0.2);
  assert.equal(g.position.x, 5, 'x at last point');
  assert.equal(g.position.z, 7, 'z at last point');
  assert.ok(Math.abs(g.position.y - (Math.hypot(5, 7) * 0.3 - 0.5)) < 1e-9, 'y follows terrain');
});

test('validation', () => {
  const g = new THREE.Group();
  assert.throws(() => new PropFollower(g, NaN), /baseY/);
  const f = new PropFollower(g, 0);
  assert.throws(() => f.update(NaN, 0, () => 0), /x\/z/);
  assert.throws(() => f.update(0, 0, () => 0, NaN), /yaw/);
  // heightAt is called with the FOLLOW position, not the old one
  let seen: [number, number] = [0, 0];
  f.update(9, 8, (x, z) => { seen = [x, z]; return 1; });
  assert.deepEqual(seen, [9, 8], 'heightAt sampled at the target');
});
