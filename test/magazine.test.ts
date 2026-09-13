import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Magazine } from '../src/game/nightraid/weapons/magazine';

test('fires consume rounds and report empty at zero', () => {
  const m = new Magazine(5, 2, 10);
  assert.equal(m.canFire(), true);
  m.consume();
  m.consume();
  assert.equal(m.rounds, 0);
  assert.equal(m.canFire(), false);
  assert.equal(m.empty, true);
});

test('reload refills from reserve and tops the mag', () => {
  const m = new Magazine(5, 1, 10);
  m.startReload(1.0);
  assert.equal(m.reloading, true);
  // not finished yet
  m.tick(0.5);
  assert.equal(m.reloading, true);
  // completes
  m.tick(0.6);
  assert.equal(m.reloading, false);
  assert.equal(m.rounds, 5);
  assert.equal(m.reserve, 6);
});

test('reload will not overdraw the reserve', () => {
  const m = new Magazine(5, 0, 2);
  m.startReload(0.1);
  m.tick(0.2);
  assert.equal(m.rounds, 2);
  assert.equal(m.reserve, 0);
  assert.equal(m.reloading, false);
});

test('reload is a no-op when full or empty reserve', () => {
  const full = new Magazine(5, 5, 10);
  full.startReload(1);
  assert.equal(full.reloading, false);

  const noAmmo = new Magazine(5, 1, 0);
  noAmmo.startReload(1);
  assert.equal(noAmmo.reloading, false);
});

test('switching cancels an in-progress reload', () => {
  const m = new Magazine(5, 0, 10);
  m.startReload(1.0);
  assert.equal(m.reloading, true);
  m.cancelReload();
  assert.equal(m.reloading, false);
  m.tick(1.0);
  assert.equal(m.rounds, 0); // nothing refilled after cancel
});
