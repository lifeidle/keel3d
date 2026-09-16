import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ViewmodelSlots,
  damp,
} from '../src/blocks/player/ViewmodelSlots';

/**
 * ViewmodelSlots — multi-slot viewmodel manager.
 * Object3D is pure JS (no WebGL), so visibility/position logic is
 * headless-testable; the kick decay math is covered via `damp`.
 */

test('damp converges toward target and is dt-scaled', () => {
  const a = damp(0, 1, 5, 0.1);
  const b = damp(a, 1, 5, 0.1);
  assert.ok(a > 0 && a < 1, `first step in-between (${a})`);
  assert.ok(b > a, 'monotonic toward target');
  assert.ok(b < 1);
  // bigger dt → closer to target (same lambda)
  const big = damp(0, 1, 5, 1);
  assert.ok(big > b, `dt=1 (${big}) further along than two 0.1 steps (${b})`);
  // already at target → unchanged
  assert.ok(Math.abs(damp(1, 1, 5, 0.1) - 1) < 1e-12);
  // lambda 0 → frozen
  assert.ok(Math.abs(damp(0.3, 1, 0, 10) - 0.3) < 1e-9);
});

test('first slot activates automatically; later slots stay hidden', () => {
  const camera = new THREE.Object3D();
  const vm0 = new THREE.Object3D();
  const vm1 = new THREE.Object3D();
  const vs = new ViewmodelSlots(camera);
  const i0 = vs.addSlot(vm0, new THREE.Vector3(0.2, -0.19, -0.42));
  const i1 = vs.addSlot(vm1, new THREE.Vector3(-0.2, -0.21, -0.4));
  assert.equal(i0, 0);
  assert.equal(i1, 1);
  assert.equal(vs.activeIndex, 0);
  assert.ok(vm0.visible, 'slot 0 visible');
  assert.ok(!vm1.visible, 'slot 1 hidden');
  assert.ok(camera.children.includes(vm0) && camera.children.includes(vm1), 'both attached to camera');
});

test('setSlot toggles visibility exclusively, no-op, and wraps', () => {
  const camera = new THREE.Object3D();
  const vm0 = new THREE.Object3D();
  const vm1 = new THREE.Object3D();
  const vm2 = new THREE.Object3D();
  const vs = new ViewmodelSlots(camera);
  vs.addSlot(vm0);
  vs.addSlot(vm1);
  vs.addSlot(vm2);
  assert.ok(vs.setSlot(1), 'switch to 1');
  assert.ok(!vm0.visible && vm1.visible && !vm2.visible, 'exclusive visibility');
  assert.equal(vs.activeIndex, 1);
  assert.ok(!vs.setSlot(1), 'already active → no-op');
  assert.ok(vs.setSlot(-1), 'negative wraps to the LAST slot');
  assert.ok(vm2.visible && !vm0.visible && !vm1.visible, 'wrap → slot 2 visible');
  assert.ok(vs.setSlot(0), 'back to 0');
  assert.ok(vm0.visible);
});

test('kick adds a decaying offset applied on update', () => {
  const camera = new THREE.Object3D();
  const vm = new THREE.Object3D();
  const vs = new ViewmodelSlots(camera);
  const base = new THREE.Vector3(0.2, -0.19, -0.42);
  vs.addSlot(vm, base);
  const before = vm.position.z;
  vs.kick(0.3);
  vs.update(0.0001); // almost no decay yet
  assert.ok(vm.position.z > before, `pushed back (${vm.position.z} > ${before})`);
  assert.ok(vm.position.y > -0.19, `lifted (${vm.position.y})`);
  // decay over 1 second → back to rest pose
  for (let i = 0; i < 100; i++) vs.update(0.01);
  assert.ok(Math.abs(vm.position.z - base.z) < 0.001, `settled back (${vm.position.z})`);
  assert.ok(Math.abs(vm.position.y - base.y) < 0.001);
});

test('setSlot on an empty manager is a no-op', () => {
  const camera = new THREE.Object3D();
  const vs = new ViewmodelSlots(camera);
  assert.ok(!vs.setSlot(0));
  assert.equal(vs.activeIndex, -1);
});
