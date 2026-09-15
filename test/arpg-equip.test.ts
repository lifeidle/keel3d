import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createArpgGame } from '../src/recipes/arpg';

/**
 * ARPG equipment test — headless (node) drive of the real recipe.
 *
 * The recipe registers keydown handlers on `window` (its own + PauseMenu's),
 * so the shim collects ALL listeners per event and calls them all.
 *
 * One-hit-kill (attackDamage 999 vs enemyHp 1) + frequent spawns +
 * equipDropChance 1 → kills produce equipment drops near the player's
 * recent path; a Lissajous sweep at move speed collects them. First drop of
 * a kind always beats the empty slot (tier > 0) → auto-equip + quest.
 */
type KeyHandler = (e: { code: string; preventDefault(): void }) => void;
const listeners: Record<string, KeyHandler[]> = {};
const winShim = {
  addEventListener: (t: string, fn: unknown) => {
    (listeners[t] ??= []).push(fn as KeyHandler);
  },
  removeEventListener: () => {},
};
(globalThis as Record<string, unknown>).window = winShim;

function press(code: string) {
  for (const h of listeners['keydown'] ?? []) h({ code, preventDefault() {} });
}
function releaseAll(codes: string[]) {
  for (const c of codes) for (const h of listeners['keyup'] ?? []) h({ code: c, preventDefault() {} });
}

test('arpg drops equipment, auto-equips, and the run still wins', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const game = createArpgGame(
    {
      id: 't-arpg',
      playerHp: 9999,
      attackDamage: 999,
      enemyHp: 1,
      enemySpeed: 12,
      spawnEvery: 0.3,
      equipDropChance: 1,
    },
    { scene, camera },
  );
  const sim = game.systems[0];
  const world = { playing: true } as never;
  const FT = 1 / 60;
  const stats = () =>
    game.stats() as { kills: number; status: string; weapon: number; armor: number; equipped: boolean };
  const DIRS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

  try {
    for (let f = 0; f < 10800 && stats().status === 'playing'; f++) {
      const t = f * FT;
      const vx = Math.cos(t * 0.9);
      const vz = Math.sin(t * 0.65);
      releaseAll(DIRS);
      if (vx > 0.25) press('KeyD');
      else if (vx < -0.25) press('KeyA');
      if (vz > 0.25) press('KeyS');
      else if (vz < -0.25) press('KeyW');
      press('Space');
      sim.update(FT, world);
    }
    const s = stats();
    assert.ok(s.kills >= 12, `killed enough enemies (got ${s.kills})`);
    assert.equal(s.status, 'win', 'run won after 12 kills');
    assert.ok(
      s.weapon >= 1 || s.armor >= 1,
      `equipment was collected & equipped (weapon=${s.weapon} armor=${s.armor})`,
    );
    assert.equal(s.equipped, true, 'first equipment pickup flags equipped');
  } finally {
    game.dispose();
    delete (globalThis as Record<string, unknown>).window;
  }
});
