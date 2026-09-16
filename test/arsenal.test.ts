import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Arsenal } from '../src/blocks/combat/Arsenal';

const SLOTS = [
  { key: 'rifle', magSize: 5, reserve: 10, reloadTime: 1, fireRate: 4, auto: true },
  { key: 'bolt', magSize: 2, reserve: 4, reloadTime: 2, fireRate: 1, auto: false },
];

test('Arsenal rejects empty slot list', () => {
  assert.throws(() => new Arsenal([]), /at least one slot/);
});

test('semi-auto fires once per click; auto fires while held', () => {
  const a = new Arsenal(SLOTS);
  // slot 0 is auto, fireRate 4 → cooldown 0.25
  assert.equal(a.update(0.1, true, false), 'fired');
  assert.equal(a.mag, 4);
  assert.equal(a.update(0.05, true, false), 'cooldown');
  assert.equal(a.update(0.3, true, false), 'fired');
  assert.equal(a.mag, 3);

  a.switchTo(1); // bolt, semi
  // swap cooldown 0.25
  assert.equal(a.update(0.01, true, true), 'cooldown');
  assert.equal(a.update(0.3, true, true), 'fired');
  assert.equal(a.mag, 1);
  // held without new click → idle (semi)
  assert.equal(a.update(0.5, true, false), 'idle');
  assert.equal(a.mag, 1);
});

test('empty auto-reloads when reserve remains', () => {
  const a = new Arsenal([{ key: 'x', magSize: 1, reserve: 2, reloadTime: 0.5, fireRate: 10, auto: true }]);
  assert.equal(a.update(0, true, false), 'fired');
  assert.equal(a.mag, 0);
  // wait out fire cooldown (0.1s at rate 10) then empty triggers reload
  assert.equal(a.update(0.15, true, false), 'empty');
  assert.equal(a.reloading, true);
  assert.equal(a.update(0.6, false, false), 'reloading');
  assert.equal(a.mag, 1);
  assert.equal(a.reserve, 1);
  assert.equal(a.reloading, false);
});

test('switchTo cancels reload and applies swap cooldown', () => {
  const a = new Arsenal(SLOTS);
  a.mag; // current slot 0 full
  // drain one then start reload
  a.update(0, true, false); // fired
  a.reload();
  assert.equal(a.reloading, true);
  assert.ok(a.switchTo(1));
  assert.equal(a.index, 1);
  assert.equal(a.reloading, false);
  assert.ok(a.cooldownRemaining > 0);
  // switching to same slot is a no-op
  assert.equal(a.switchTo(1), false);
});

test('reset tops all mags; refillAll restores reserve', () => {
  const a = new Arsenal(SLOTS);
  a.update(0, true, false);
  a.update(0.3, true, false);
  assert.equal(a.mag, 3);
  a.switchTo(1);
  a.update(0.3, true, true);
  assert.equal(a.mag, 1);
  a.reset();
  assert.equal(a.index, 0);
  assert.equal(a.mag, 5);
  a.switchTo(1);
  assert.equal(a.mag, 2);
  assert.equal(a.reserve, 4);
  a.update(0.3, true, true); // consume 1
  a.refillAll();
  // refillAll tops reserve only (not mag)
  assert.equal(a.reserve, 4);
});

test('recoil add and decay', () => {
  const a = new Arsenal(SLOTS, { recoilDecay: 0.5 });
  a.addRecoil(0.2);
  a.addRecoil(0.1);
  assert.ok(Math.abs(a.recoil - 0.3) < 1e-9);
  const left = a.decayRecoil(0.4);
  assert.ok(Math.abs(left - 0.1) < 1e-9);
  a.decayRecoil(1);
  assert.equal(a.recoil, 0);
});

test('addReserve tops up spent rounds, clamped at the configured max', () => {
  const a = new Arsenal(SLOTS);
  // firing does NOT spend reserve — reload does. Drain the mag, reload
  // (reserve 10 → 5), then top up.
  for (let i = 0; i < 5; i++) {
    a.update(0, true, false);
    a.update(0.26, false, false);
  }
  assert.equal(a.mag, 0);
  a.reload();
  a.update(1.1, false, false); // reloadTime 1
  assert.equal(a.mag, 5);
  assert.equal(a.reserve, 5);
  const added = a.addReserve(3);
  assert.equal(added, 3, 'adds the full amount below the cap');
  assert.equal(a.reserve, 8);
  const clamped = a.addReserve(100);
  assert.equal(clamped, 2, 'clamped at the slot reserve (10)');
  assert.equal(a.reserve, 10);
  assert.equal(a.addReserve(4), 0, 'nothing to add at the cap');
});

test('addReserve targets a specific slot', () => {
  const a = new Arsenal(SLOTS);
  a.switchTo(1); // bolt: magSize 2, reserve 4
  a.update(0.3, true, true); // semi fire → mag 1
  a.reload();
  a.update(2.1, false, false); // reloadTime 2 → mag 2, reserve 3
  assert.equal(a.mag, 2);
  assert.equal(a.reserve, 3);
  assert.equal(a.addReserve(2, 1), 1, 'clamped at slot 1 cap (4): 3 + 1');
  assert.equal(a.reserve, 4);
  assert.equal(a.addReserve(5, 1), 0, 'nothing to add at the cap');
  a.switchTo(0);
  assert.equal(a.reserve, 10, 'slot 0 untouched');
});
