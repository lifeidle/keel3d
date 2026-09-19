import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arsenal } from '../src/blocks/combat/Arsenal';
import { Magazine } from '../src/blocks/combat/Magazine';

/**
 * Arsenal.setReserve / Magazine.setReserve (R76 — ammo events + test hooks).
 */

function twoSlots() {
  return new Arsenal([
    { key: 'r', magSize: 30, reserve: 90, reloadTime: 1.6, fireRate: 6, auto: true },
    { key: 's', magSize: 40, reserve: 120, reloadTime: 2.2, fireRate: 11, auto: true },
  ]);
}

test('setReserve sets the value; clamps to [0, slot cap]', () => {
  const a = twoSlots();
  assert.equal(a.setReserve(50), 50, 'plain set');
  assert.equal(a.reserve, 50);
  assert.equal(a.setReserve(-30), 0, 'floored at 0');
  assert.equal(a.setReserve(999), 90, 'clamped at the slot cap');
});

test('per-slot targeting (slot 0 vs slot 1)', () => {
  const a = twoSlots();
  a.setReserve(20, 0);
  a.setReserve(70, 1);
  assert.equal(a.reserve, 20, 'slot 0 (active)');
  a.switchTo(1);
  assert.equal(a.reserve, 70, 'slot 1 untouched by slot-0 set');
  a.setReserve(5); // active slot (now 1)
  assert.equal(a.reserve, 5);
});

test('in-progress reload keeps running; completion reads the reserve then', () => {
  const a = twoSlots();
  // empty the mag so startReload is allowed
  for (let i = 0; i < 30; i++) a.update(1 / 6, true, false);
  a.reload();
  assert.equal(a.reloading, true);
  assert.equal(a.setReserve(30), 30, 'setter works mid-reload');
  a.update(1.6); // complete
  assert.equal(a.reloading, false);
  assert.equal(a.mag, 30, 'refilled to mag size');
  assert.equal(a.reserve, 0, 'reserve drained at completion');
});

test('Magazine.setReserve floors at 0 and addReserve still caps at the slot cap', () => {
  const m = new Magazine(30, 5, 90);
  assert.equal(m.setReserve(-10), 0);
  assert.equal(m.setReserve(45), 45);
  const a = twoSlots();
  a.setReserve(10);
  assert.equal(a.addReserve(1000), 80, 'addReserve still capped at 90');
});
