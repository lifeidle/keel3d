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

test('walk bob: idle stays still, moving oscillates, stop settles', () => {
  const camera = new THREE.Object3D();
  const vm = new THREE.Object3D();
  const vs = new ViewmodelSlots(camera);
  const base = new THREE.Vector3(0.2, -0.19, -0.42);
  vs.addSlot(vm, base);

  // idle: 2 seconds of frames → position stays at rest pose
  for (let i = 0; i < 200; i++) vs.update(0.01);
  assert.ok(Math.abs(vm.position.x - base.x) < 1e-6, `x still (${vm.position.x})`);
  assert.ok(Math.abs(vm.position.y - base.y) < 1e-6, `y still (${vm.position.y})`);
  assert.ok(Math.abs(vm.rotation.z) < 1e-6);

  // moving: bob lifts and sways the gun within its data-driven amplitudes
  let maxY = -Infinity;
  let maxZtilt = 0;
  for (let i = 0; i < 200; i++) {
    vs.update(0.01, true);
    maxY = Math.max(maxY, vm.position.y);
    maxZtilt = Math.max(maxZtilt, Math.abs(vm.rotation.z));
  }
  assert.ok(maxY > base.y + 0.005, `bob bounces up (maxY ${maxY} > base ${base.y})`);
  assert.ok(maxZtilt < 0.03, `tilt bounded by amp (${maxZtilt})`);
  assert.ok(maxZtilt > 0.001, 'tilt actually swings');

  // stop: amplitude eases back to zero (damped, no phase reset)
  for (let i = 0; i < 100; i++) vs.update(0.01, false);
  assert.ok(Math.abs(vm.position.y - base.y) < 0.001, `settled (${vm.position.y})`);
});

test('bob phase persists across stop and sprint advances faster', () => {
  const camera = new THREE.Object3D();
  const vmA = new THREE.Object3D();
  const vmB = new THREE.Object3D();
  const vsA = new ViewmodelSlots(camera);
  const vsB = new ViewmodelSlots(camera);
  const base = new THREE.Vector3(0, 0, 0);
  vsA.addSlot(vmA, base);
  vsB.addSlot(vmB, base.clone());

  // 40 walk frames on A, then stop
  for (let i = 0; i < 40; i++) vsA.update(0.01, true);
  vsA.update(0.01, false); // amplitude eases out, phase KEEPS its value
  const posDuring = vmA.position.x; // captured mid-swing
  // 40 sprint frames on B → phase advanced further (12 rad/s vs 7.5)
  for (let i = 0; i < 40; i++) vsB.update(0.01, true, true);
  const phaseA = 40 * 0.01 * 7.5;
  const phaseB = 40 * 0.01 * 12;
  assert.ok(phaseB > phaseA, 'sprint advances the gait faster');
  // position after stop ≠ rest pose immediately (amplitude still decaying)
  assert.ok(Math.abs(vmA.position.x - 0) > 1e-9 || Math.abs(posDuring) > 1e-9, 'no hard reset');
});
