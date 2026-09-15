import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTowerDefenseGame } from '../src/recipes/tower-defense';

/**
 * TD multi-map (campaign) test — headless (node) drive of the real recipe.
 *
 * No tower is placed (placement needs a click, which node lacks), so every
 * enemy simply walks the lane to the base; each map therefore "clears" once
 * its single wave has leaked and the field is empty — which is exactly the
 * advance condition (director.finished && activeCount === 0). We assert the
 * campaign machinery: map index advances, base HP is restored on advance,
 * the last map produces a campaign win, and legacy single-map opts still work.
 */
const MAPS = [
  { name: 'M1', lane: [{ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }], pads: [{ x: 0, z: 4 }] },
  { name: 'M2', lane: [{ x: 0, y: 0, z: -10 }, { x: 0, y: 0, z: 10 }], pads: [{ x: 4, z: 0 }] },
  { name: 'M3', lane: [{ x: -8, y: 0, z: -8 }, { x: 8, y: 0, z: 8 }], pads: [{ x: 0, z: 0 }] },
];

function campaignGame() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const game = createTowerDefenseGame(
    {
      id: 't-td',
      maps: MAPS,
      startMoney: 9999,
      baseHp: 5,
      enemyHp: 1,
      enemySpeed: 30,
      bounty: 0,
      waves: [{ count: 3, interval: 0.2, delay: 0.5, unit: 'grunt' }],
    },
    { scene, camera },
  );
  const sim = game.systems[0];
  const world = { playing: true } as never;
  return { game, sim, world };
}

test('td campaign: clear all waves → next map → campaign win', () => {
  const { game, sim, world } = campaignGame();
  const FT = 1 / 60;
  const stats = () =>
    game.stats() as { map: number; mapCount: number; baseHp: number; status: string };

  try {
    const s0 = stats();
    assert.equal(s0.map, 1, 'starts on map 1');
    assert.equal(s0.mapCount, 3, 'three-map campaign');

    for (let f = 0; f < 6000 && stats().map === 1 && stats().status === 'playing'; f++) {
      sim.update(FT, world);
    }
    const s1 = stats();
    assert.equal(s1.map, 2, 'advanced to map 2 after clearing map 1');
    assert.equal(s1.baseHp, 5, 'base HP restored on advance');

    for (let f = 0; f < 6000 && stats().map === 2 && stats().status === 'playing'; f++) {
      sim.update(FT, world);
    }
    assert.equal(stats().map, 3, 'advanced to map 3');

    for (let f = 0; f < 6000 && stats().status === 'playing'; f++) {
      sim.update(FT, world);
    }
    const sF = stats();
    assert.equal(sF.map, 3, 'last map still map 3');
    assert.equal(sF.status, 'win', 'campaign win after the last map');
  } finally {
    game.dispose();
  }
});

test('td single-map (legacy lane/pads) still wins without campaign', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const game = createTowerDefenseGame(
    {
      id: 't-td-single',
      lane: [{ x: -10, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }],
      pads: [{ x: 0, z: 4 }],
      startMoney: 9999,
      baseHp: 5,
      enemyHp: 1,
      enemySpeed: 30,
      bounty: 0,
      waves: [{ count: 2, interval: 0.2, delay: 0.5, unit: 'grunt' }],
    },
    { scene, camera },
  );
  const sim = game.systems[0];
  const world = { playing: true } as never;
  const st = () => game.stats() as { map: number; mapCount: number; status: string };

  try {
    assert.equal(st().mapCount, 1, 'legacy opts → single map');
    for (let f = 0; f < 3000; f++) {
      sim.update(1 / 60, world);
      if (st().status !== 'playing') break;
    }
    assert.equal(st().status, 'win', 'single map still wins');
  } finally {
    game.dispose();
  }
});
