import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Health } from '../src/blocks/gameplay/Health';
import { Timers } from '../src/blocks/gameplay/Timers';
import { Economy } from '../src/blocks/gameplay/Economy';
import { Scoreboard } from '../src/blocks/gameplay/Scoreboard';
import { WaveDirector } from '../src/blocks/gameplay/WaveDirector';
import { PlaceGrid } from '../src/blocks/gameplay/PlaceGrid';
import { Spawner } from '../src/blocks/gameplay/Spawner';

test('Health damage/heal/death', () => {
  let died = 0;
  const h = new Health({ max: 100, onDeath: () => died++ });
  assert.equal(h.damage(30), true);
  assert.equal(h.hp, 70);
  h.heal(20);
  assert.equal(h.hp, 90);
  h.damage(90);
  assert.equal(h.alive, false);
  assert.equal(died, 1);
  h.revive();
  assert.equal(h.alive, true);
  assert.equal(h.hp, 100);
});

test('Timers after/every', () => {
  const t = new Timers();
  let n = 0;
  t.after(1, () => n++);
  t.every(0.5, () => n++);
  t.update(0.4);
  assert.equal(n, 0);
  t.update(0.2); // 0.6s → every fires
  assert.equal(n, 1);
  t.update(0.5); // 1.1s → every + after
  assert.ok(n >= 3);
});

test('Economy add/spend/canAfford', () => {
  const e = new Economy({ start: 50 });
  assert.equal(e.canAfford(50), true);
  assert.equal(e.spend(50), true);
  assert.equal(e.balance, 0);
  assert.equal(e.spend(1), false);
  e.add(10);
  assert.equal(e.balance, 10);
});

test('Scoreboard counters', () => {
  const s = new Scoreboard();
  s.addKill(2);
  s.add('gold', 5);
  s.tick(1.5);
  assert.equal(s.kills, 2);
  assert.equal(s.get('gold'), 5);
  assert.ok(Math.abs(s.time - 1.5) < 1e-9);
});

test('WaveDirector spawns a full wave list', () => {
  const spawned: number[] = [];
  let allDone = 0;
  const w = new WaveDirector({
    waves: [
      { count: 2, interval: 0.1, delay: 0 },
      { count: 1, interval: 0.1, delay: 0 },
    ],
    spawnFn: (_wave, i) => spawned.push(i),
    onAllComplete: () => allDone++,
  });
  for (let i = 0; i < 50; i++) w.update(0.05);
  assert.equal(spawned.length, 3);
  assert.equal(w.finished, true);
  assert.equal(allDone, 1);
});

test('PlaceGrid occupy and snap', () => {
  const g = new PlaceGrid({ originX: 0, originZ: 0, cell: 2, width: 4, height: 4 });
  const s = g.snapFree(1, 1);
  assert.ok(s);
  assert.equal(g.occupy(s!.ix, s!.iz), true);
  assert.equal(g.occupy(s!.ix, s!.iz), false);
  assert.equal(g.isOccupied(s!.ix, s!.iz), true);
  g.release(s!.ix, s!.iz);
  assert.equal(g.isFree(s!.ix, s!.iz), true);
});

test('Spawner spawn/damage/reap', () => {
  type H = { id: number };
  let id = 0;
  const deaths: string[] = [];
  const sp = new Spawner<H>({
    table: { grunt: { hp: 10, bounty: 5 } },
    create: () => ({ id: id++ }),
    onDeath: (u) => deaths.push(u.key),
  });
  const u = sp.spawn('grunt');
  assert.ok(u);
  sp.damage(u!, 4);
  assert.equal(u!.hp, 6);
  sp.damage(u!, 6);
  assert.equal(u!.alive, false);
  assert.deepEqual(deaths, ['grunt']);
  sp.reap();
  assert.equal(sp.aliveCount, 0);
});
