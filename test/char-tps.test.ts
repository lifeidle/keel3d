import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMoveIntent } from '../src/blocks/player/CharacterController';
import { Gamepad } from '../src/blocks/input/Gamepad';
import { CameraRig } from '../src/blocks/CameraRig';
import * as THREE from 'three';

test('computeMoveIntent scales and rotates by yaw', () => {
  const idle = computeMoveIntent({ moveX: 0, moveZ: 0, jump: false }, 0, 6, 1);
  assert.equal(idle.vx, 0);
  assert.equal(idle.vz, 0);

  // forward at yaw=0 → -Z
  const fwd = computeMoveIntent({ moveX: 0, moveZ: -1, jump: false }, 0, 6, 1);
  assert.ok(Math.abs(fwd.vx) < 1e-6);
  assert.ok(fwd.vz < -5);

  const sprint = computeMoveIntent({ moveX: 0, moveZ: -1, jump: false, sprint: true }, 0, 6, 2);
  assert.ok(sprint.vz < fwd.vz * 1.5);
});

test('Gamepad poll is safe without navigator pads', () => {
  const g = new Gamepad();
  g.poll();
  assert.equal(g.connected, false);
  assert.equal(g.moveX, 0);
  assert.equal(g.fire, false);
  assert.equal(g.btn('a'), false);
});

test('CameraRig shoulder mode sets position behind target', () => {
  const cam = new THREE.PerspectiveCamera();
  const rig = new CameraRig(cam, { defaultMode: 'shoulder', blend: 0 });
  const target = new THREE.Vector3(0, 1, 0);
  rig.update(0.016, target, 0);
  // yaw=0 → camera should be at +Z (behind)
  assert.ok(cam.position.z > 0);
  assert.ok(cam.position.y > 1);
});
