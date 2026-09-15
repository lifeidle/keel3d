import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRoguelikeGame } from '../src/recipes/roguelike';
import { generateDungeon } from '../src/blocks/world/ProcDungeon';

/**
 * Roguelike endless-descent test — headless (node) drive of the real recipe.
 *
 * The recipe registers keydown/keyup on `window`; we shim `window` with a
 * handler-capture object so we can inject movement/attack keys and run the
 * sim system directly. One-hit-kill (attackDamage 999) + fast enemies make
 * the walk → boss gauntlet → descend sequence deterministic.
 *
 * Note the boss-room clear rule: `living === 0` counts ALL live enemies on
 * the floor (they chase the player), so the boss fight is a whole-floor
 * converge — the test accounts for that with a generous frame budget.
 */
const SEED = 7;
const ROOM_COUNT = 4;
const CELL = 18;
const FT = 1 / 60;

// window shim (test files run in separate node processes; clean up after).
const keyHandlers: Record<string, (e: { code: string; preventDefault(): void }) => void> = {};
const winShim = {
  addEventListener: (t: string, fn: unknown) => {
    keyHandlers[t] = fn as typeof keyHandlers['keydown'];
  },
  removeEventListener: () => {},
};
(globalThis as Record<string, unknown>).window = winShim;

function press(code: string) {
  keyHandlers['keydown']?.({ code, preventDefault() {} });
}
function releaseAll() {
  for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']) keyHandlers['keyup']?.({ code: c, preventDefault() {} });
}

/** Floor-center of room `idx` on depth `d` — mirrors the recipe's seed derivation. */
function roomCenter(d: number, idx: number) {
  const layout = generateDungeon(SEED + (d - 1) * 7919, { roomCount: ROOM_COUNT });
  const c = layout.roomCenter(layout.rooms[idx], CELL);
  return c;
}

/**
 * Exact enemy count for floor `d` — mirrors the recipe's spawnRoom rule
 * (boss room: 3 · loot room: 0 · start/combat: combatSpawns(depth)).
 * Which rooms are combat vs loot depends on the seed, so this is computed
 * from the layout rather than assumed.
 */
function expectedKills(d: number): number {
  const layout = generateDungeon(SEED + (d - 1) * 7919, { roomCount: ROOM_COUNT });
  const combatSpawns = 2 + Math.min(2, Math.floor((d - 1) / 2));
  let n = 0;
  for (const r of layout.rooms) {
    if (r.kind === 'boss') n += 3;
    else if (r.kind === 'loot') n += 0;
    else n += combatSpawns;
  }
  return n;
}

test('roguelike descends floors after the boss gauntlet (endless)', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const game = createRoguelikeGame(
    {
      id: 't-rogue',
      seed: SEED,
      roomCount: ROOM_COUNT,
      attackDamage: 999,
      playerHp: 9999,
      enemyHp: 1,
      enemySpeed: 12,
    },
    { scene, camera },
  );
  const sim = game.systems[0];
  const world = { playing: true } as never;
  const stats = () => game.stats() as {
    depth: number;
    best: number;
    room: number;
    status: string;
    hp: number;
    kills: number;
    cleared: number;
  };

  try {
    const s0 = stats();
    assert.equal(s0.depth, 1);
    assert.equal(s0.best, 0);
    assert.equal(s0.status, 'playing');
    assert.equal(s0.hp, 9999);

    // ---- phase 1: walk room → room → boss (axis-aligned, one key at a time) ----
    const walkToBoss = (depth: number, budget: number) => {
      releaseAll();
      for (let f = 0; f < budget && stats().room < ROOM_COUNT - 1 && stats().depth === depth; f++) {
        const cur = roomCenter(depth, stats().room);
        const next = roomCenter(depth, stats().room + 1);
        releaseAll();
        if (next.x > cur.x + 0.1) press('KeyD');
        else if (next.x < cur.x - 0.1) press('KeyA');
        else if (next.z > cur.z + 0.1) press('KeyS');
        else if (next.z < cur.z - 0.1) press('KeyW');
        for (let k = 0; k < 30; k++) sim.update(FT, world);
      }
      assert.equal(stats().room, ROOM_COUNT - 1, `depth ${depth}: reached boss room`);
    };

    walkToBoss(1, 4000);

    // ---- phase 2: boss gauntlet — the whole floor's swarm converges; one-shot each ----
    for (let f = 0; f < 3600 && stats().depth === 1; f++) {
      press('Space');
      sim.update(FT, world);
    }
    const s1 = stats();
    assert.equal(s1.depth, 2, 'descended to floor 2 after boss gauntlet');
    assert.equal(s1.status, 'playing', 'still alive after first descent');
    assert.equal(s1.best, 2, 'deepest record saved on descent');
    assert.equal(s1.cleared, 0, 'room-clear state reset for the new floor');
    assert.equal(s1.room, 0, 'player repositioned to the new start room');
    assert.equal(s1.kills, expectedKills(1), `all floor-1 enemies dead (got ${s1.kills})`);

    // ---- phase 3: descend again — new layout (different seed), same loop ----
    walkToBoss(2, 4000);
    for (let f = 0; f < 3600 && stats().depth === 2; f++) {
      press('Space');
      sim.update(FT, world);
    }
    const s2 = stats();
    assert.equal(s2.depth, 3, 'descended to floor 3');
    assert.equal(s2.best, 3, 'deepest record advanced');
    assert.equal(s2.status, 'playing');
    assert.equal(
      s2.kills,
      expectedKills(1) + expectedKills(2),
      'kill counter is cumulative across floors',
    );
  } finally {
    game.dispose();
    delete (globalThis as Record<string, unknown>).window;
  }
});

test('roguelike dies and records the deepest floor', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const game = createRoguelikeGame(
    { id: 't-rogue2', seed: 21, roomCount: 4, playerHp: 40, enemySpeed: 12, enemyHp: 1 },
    { scene, camera },
  );
  const sim = game.systems[0];
  const world = { playing: true } as never;
  const stats = () => game.stats() as { status: string; depth: number; hp: number };
  try {
    // idle in the start room: the 2 spawn enemies close in and drain 40 HP.
    for (let f = 0; f < 12000 && stats().status === 'playing'; f++) sim.update(FT, world);
    assert.equal(stats().status, 'lose');
    assert.equal(stats().hp, 0);
    assert.equal(stats().depth, 1, 'died on floor 1');
  } finally {
    game.dispose();
  }
});
