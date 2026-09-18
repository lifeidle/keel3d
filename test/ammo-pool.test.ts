import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AmmoPool } from '../src/blocks/combat/AmmoPool';

/**
 * AmmoPool — mag/reserve/reload state machine (pure, headless).
 */

test('fire consumes rounds; empty mag with reserve auto-reloads', () => {
  const a = new AmmoPool(3, 6, 1.0);
  assert.equal(a.fire(), true);
  assert.equal(a.magLeft, 2);
  assert.equal(a.fire(), true);
  assert.equal(a.fire(), true); // mag empty, reserve left
  assert.equal(a.isReloading, true, 'auto-reload started');
  assert.equal(a.fire(), false, 'no shot while reloading');
  a.update(0.5); // mid-reload
  assert.equal(a.magLeft, 0);
  a.update(0.6); // done (total 1.1 ≥ 1.0)
  assert.equal(a.magLeft, 3);
  assert.equal(a.reserveLeft, 3);
  assert.equal(a.isReloading, false);
});

test('partial reload when reserve < magSize', () => {
  const a = new AmmoPool(30, 2, 1.0);
  for (let i = 0; i < 30; i++) a.fire();
  assert.equal(a.isReloading, true);
  a.update(1.0);
  assert.equal(a.magLeft, 2, 'only what the reserve holds');
  assert.equal(a.reserveLeft, 0);
  assert.equal(a.isReloading, false);
  assert.equal(a.fire(), true);
  assert.equal(a.fire(), true); // the last two rounds
  assert.equal(a.fire(), false, 'empty mag, zero reserve → no reload');
  assert.equal(a.isDry, true, 'dry after spending the partial mag');
});

test('addReserve respects the cap and floors the amount', () => {
  const a = new AmmoPool(30, 10, 1.0);
  assert.equal(a.addReserve(50, 60), 50);
  assert.equal(a.reserveLeft, 60);
  assert.equal(a.addReserve(50, 60), 0, 'at the cap → nothing added');
  assert.equal(a.addReserve(2.7), 2, 'floored');
});

test('update without a reload is a no-op; invalid params throw', () => {
  const a = new AmmoPool(5, 5, 1.0);
  a.update(5);
  assert.equal(a.magLeft, 5);
  assert.equal(a.reserveLeft, 5);
  assert.throws(() => new AmmoPool(0, 5, 1.0));
  assert.throws(() => new AmmoPool(5, 5, 0));
});
