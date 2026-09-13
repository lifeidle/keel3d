import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineGame } from '../src/content/defineGame';
import { PlaceGrid } from '../src/blocks/gameplay/PlaceGrid';
import { Spawner } from '../src/blocks/gameplay/Spawner';
import { LevelTable } from '../src/blocks/progress/LevelTable';
import { RunState } from '../src/blocks/progress/RunState';
import { BuildSystem } from '../src/blocks/build/BuildCatalog';

test('defineGame validates spec', () => {
  assert.throws(() => defineGame({} as never), /spec.id is required/);
  assert.throws(
    () => defineGame({ id: 'x', title: '', create: () => ({ systems: [] }) } as never),
    /title is required/,
  );
  assert.throws(
    () => defineGame({ id: 'x', title: 'X', create: 'nope' } as never),
    /create must be a function/,
  );
  // create is optional at define time (legacy mount-path games)
  const noCreate = defineGame({ id: 'legacy', title: 'Legacy' });
  assert.equal(noCreate.id, 'legacy');
  assert.throws(() => noCreate.instantiate!({} as never), /no create\(\) factory/);
  const ok = defineGame({
    id: 'ok',
    title: 'OK',
    create: () => ({ systems: [] }),
  });
  assert.equal(ok.id, 'ok');
  assert.ok(typeof ok.instantiate === 'function');
});

test('PlaceGrid occupy/release/inBounds', () => {
  const g = new PlaceGrid({ originX: 0, originZ: 0, cell: 2, width: 4, height: 4 });
  assert.equal(g.occupy(0, 0), true);
  assert.equal(g.occupy(0, 0), false);
  assert.equal(g.occupy(99, 0), false);
  g.release(0, 0);
  assert.equal(g.isFree(0, 0), true);
  assert.equal(g.occupiedCount, 0);
});

test('Spawner spawn/damage/reap/clear', () => {
  let created = 0;
  const sp = new Spawner<{ id: number }>({
    table: { a: { hp: 10 }, b: { hp: 5 } },
    create: () => ({ id: ++created }),
    destroy: () => {},
  });
  assert.equal(sp.spawn('missing'), null);
  const u = sp.spawn('a');
  assert.ok(u);
  assert.equal(sp.aliveCount, 1);
  sp.damage(u!, 10);
  assert.equal(u!.alive, false);
  sp.reap();
  assert.equal(sp.aliveCount, 0);
  sp.spawn('b');
  sp.clear();
  assert.equal(sp.aliveCount, 0);
});

test('LevelTable serialize/restore', () => {
  const lt = new LevelTable([{ id: 'a' }, { id: 'b', requires: 'a' }]);
  lt.markCleared('a');
  const snap = lt.serialize();
  const lt2 = new LevelTable([{ id: 'a' }, { id: 'b', requires: 'a' }]);
  lt2.restore(snap);
  assert.equal(lt2.isCleared('a'), true);
  assert.equal(lt2.nextLevel()?.id, 'b');
});

test('RunState custom keys and snapshot', () => {
  const r = new RunState();
  r.set('waves', 2);
  r.addKill(3);
  r.tick(1.5);
  assert.equal(r.get('waves'), 2);
  assert.equal(r.kills, 3);
  assert.equal(r.time, 1.5);
  const snap = r.snapshot();
  assert.equal(snap.waves, 2);
  assert.equal(snap.kills, 3);
  r.reset();
  assert.equal(r.get('waves'), 0);
  assert.equal(r.kills, 0);
});

test('BuildSystem place/upgrade/remove', () => {
  let gold = 200;
  const bs = new BuildSystem({
    catalog: {
      a: { key: 'a', cost: 50, upgradeTo: 'a2', upgradeCost: 30 },
      a2: { key: 'a2', cost: 0 },
    },
    canPay: (c) => gold >= c,
    pay: (c) => {
      gold -= c;
    },
  });
  assert.ok(bs.place('a', 0, 0));
  assert.equal(gold, 150);
  assert.ok(bs.upgrade(0, 0));
  assert.equal(gold, 120);
  assert.equal(bs.at(0, 0)?.key, 'a2');
  const removed = bs.remove(0, 0);
  assert.equal(removed?.key, 'a2');
  assert.equal(bs.at(0, 0), null);
  assert.equal(bs.buildings.length, 0);
  assert.ok(bs.place('a', 0, 0));
});
