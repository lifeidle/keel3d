import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRaceGame } from '../src/recipes/race';

/**
 * Race recipe — headless (node) drive. The car auto-drives the looped track
 * (no input needed). The track total length is ~136.7 units, so at speed 12
 * one lap takes ~11.4s; assert the lap counter reaches 2 and the car stays on
 * track. (BestScoreSlot is a no-op in node — no localStorage — so we only
 * assert the lap/time machinery, not the saved best.)
 */
const TRACK = [
  { x: -20, y: 0, z: -12 },
  { x: 20, y: 0, z: -12 },
  { x: 24, y: 0, z: 12 },
  { x: -24, y: 0, z: 12 },
  { x: -20, y: 0, z: -12 },
];

test('race recipe: car completes laps and wraps around', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const game = createRaceGame(
    { id: 't-race', track: TRACK, speed: 12 },
    { scene, camera },
  );
  const sim = game.systems[0];
  const world = { playing: true } as never;
  const stats = () =>
    game.stats() as { lap: number; dist: number; status: string; time: number };

  try {
    // drive until 2 laps (cap ~30s = 1800 frames)
    for (let f = 0; f < 1800 && stats().lap < 2; f++) {
      sim.update(1 / 60, world);
    }
    const s = stats();
    assert.ok(s.lap >= 2, `completed 2+ laps (got ${s.lap})`);
    assert.ok(s.dist >= 0 && s.dist < 200, `dist on track (got ${s.dist.toFixed(1)})`);
    assert.ok(s.time > 0);
    assert.equal(s.status, 'playing', 'endless time trial stays playing');
  } finally {
    game.dispose();
  }
});

test('race recipe: lapsToWin ends the race', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const game = createRaceGame(
    { id: 't-race-win', track: TRACK, speed: 12, lapsToWin: 2 },
    { scene, camera },
  );
  const sim = game.systems[0];
  const world = { playing: true } as never;
  const stats = () => game.stats() as { lap: number; status: string };

  try {
    for (let f = 0; f < 3600 && stats().status === 'playing'; f++) {
      sim.update(1 / 60, world);
    }
    const s = stats();
    assert.ok(s.lap >= 2, `reached 2 laps (got ${s.lap})`);
    assert.equal(s.status, 'win', 'race ends after lapsToWin');
  } finally {
    game.dispose();
  }
});
