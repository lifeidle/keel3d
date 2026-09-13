import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cooldown } from '../src/blocks/combat/Cooldown';
import { pickTarget } from '../src/blocks/combat/Targeting';
import { Projectile, stepProjectiles } from '../src/blocks/combat/Projectile';
import { areaHits } from '../src/blocks/combat/AreaDamage';
import { BuildSystem } from '../src/blocks/build/BuildCatalog';
import { LevelTable } from '../src/blocks/progress/LevelTable';

test('Cooldown fire and recover', () => {
  const c = new Cooldown(1);
  assert.equal(c.tryFire(), true);
  assert.equal(c.tryFire(), false);
  c.update(0.5);
  assert.equal(c.ready, false);
  c.update(0.6);
  assert.equal(c.tryFire(), true);
});

test('pickTarget nearest in range', () => {
  const list = [
    { x: 10, z: 0, alive: true },
    { x: 3, z: 0, alive: true },
    { x: 1, z: 0, alive: false },
  ];
  const t = pickTarget(0, 0, list, undefined, { range: 5 });
  assert.equal(t?.x, 3);
  assert.equal(pickTarget(0, 0, list, undefined, { range: 0.5 }), null);
});

test('Projectile hits sphere target', () => {
  const p = new Projectile({ x: 0, z: 0, dx: 1, dz: 0, speed: 10, damage: 15 });
  const hits = stepProjectiles(
    [p],
    [{ x: 5, z: 0, radius: 0.5, alive: true, ref: 'mob' }],
    0.4,
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].damage, 15);
  assert.equal(hits[0].target, 'mob');
});

test('areaHits radius', () => {
  const list = [
    { x: 1, z: 0 },
    { x: 9, z: 0 },
  ];
  assert.equal(areaHits(0, 0, 5, list).length, 1);
  assert.equal(areaHits(0, 0, 20, list).length, 2);
});

test('BuildSystem place/upgrade/produce', () => {
  let gold = 200;
  const sys = new BuildSystem({
    catalog: {
      hut: { key: 'hut', cost: 50, produce: 1, produceEvery: 1 },
      hut2: { key: 'hut2', cost: 80, produce: 2, produceEvery: 1, hp: 120 },
    },
    canPay: (c) => gold >= c,
    pay: (c) => {
      gold -= c;
    },
  });
  const b = sys.place('hut', 1, 1);
  assert.ok(b);
  assert.equal(gold, 150);
  assert.equal(sys.place('hut', 1, 1), null);
  // upgrade: hut needs upgradeTo
  const withUp = new BuildSystem({
    catalog: {
      a: { key: 'a', cost: 10, upgradeTo: 'b', upgradeCost: 5 },
      b: { key: 'b', cost: 20, hp: 99 },
    },
    canPay: () => true,
    pay: () => {},
  });
  withUp.place('a', 0, 0);
  const u = withUp.upgrade(0, 0);
  assert.equal(u?.key, 'b');
  assert.equal(u?.level, 2);
  let made = 0;
  for (let i = 0; i < 3; i++) made += sys.update(1);
  assert.equal(made, 3);
});

test('LevelTable unlock chain', () => {
  const lt = new LevelTable([
    { id: 'l1' },
    { id: 'l2', requires: 'l1' },
    { id: 'l3', requires: 'l2' },
  ]);
  assert.equal(lt.nextLevel()?.id, 'l1');
  assert.equal(lt.isUnlocked({ id: 'l2', requires: 'l1' }), false);
  lt.markCleared('l1');
  assert.equal(lt.nextLevel()?.id, 'l2');
  lt.restore(lt.serialize());
  assert.equal(lt.isCleared('l1'), true);
});
