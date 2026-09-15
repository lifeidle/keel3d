import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOpenWorldGame } from '../src/recipes/open';

/**
 * Openworld goal-chain test — headless (node) drive of the openworld recipe
 * (the demo-cultivation content package is a thin wrapper over it).
 *
 * The demo auto-walks a figure-8 patrol, so every objective is guaranteed
 * on a fixed timeline (no input needed, no window shim needed — the demo
 * guards its DOM/window usage):
 *   1) orbs: patrol passes all five orb spots (placed on the path) → 3
 *      collected well before ~10s;
 *   2) beasts: first spawn at t≈4s, then every 5s, cap 3 → a swarm of 3
 *      alive by ~14s;
 *   3) realm: the figure-8 crosses the central dais twice per ~21s cycle
 *      (~2.7s inside the radius each time) → progress 1.0 → 筑基 by ~50s.
 * Assert the chain machinery: all three flags, status 'win', and the
 * post-chain cultivation reward (×2) still lets the realm keep rising.
 */
const FT = 1 / 60;

test('openworld goal chain: orbs + 筑基 breakthrough + beast swarm → win', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const game = createOpenWorldGame({ id: 't-cultivation' }, { scene, camera });
  const sim = game.systems[0];
  const world = { playing: true } as never;
  const stats = () =>
    game.stats() as {
      orbs: number;
      realm: string;
      beasts: number;
      beastMax: number;
      status: string;
      chainDone: boolean;
    };

  try {
    for (let f = 0; f < 7200 && !stats().chainDone; f++) {
      sim.update(FT, world);
    }
    const s = stats();
    assert.ok(s.orbs >= 3, `collected 3+ orbs (got ${s.orbs})`);
    assert.equal(s.beastMax, 3, 'a swarm of 3 beasts was alive at once');
    assert.equal(s.realm, '筑基', 'broke through to 筑基 on the dais');
    assert.equal(s.chainDone, true, 'goal chain completed');
    assert.equal(s.status, 'win');

    // After the chain, cultivation runs ×2 and the realm keeps rising.
    const realmBefore = s.realm;
    for (let f = 0; f < 14400 && stats().realm === realmBefore && stats().realm !== '元婴'; f++) {
      sim.update(FT, world);
    }
    assert.ok(stats().realm !== '炼气', `realm kept rising after the chain (now ${stats().realm})`);
  } finally {
    game.dispose();
  }
});
