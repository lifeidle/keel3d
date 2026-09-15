import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFlightGame } from '../src/recipes/flight';

/**
 * Flight recipe — headless (node) drive. The plane auto-flies a horizontal
 * circle (radius 30) with a vertical bob (altitude 10 ± 4). No input needed.
 * Assert the flight envelope stays on the expected circle/altitude band.
 */
test('flight recipe: plane circles at altitude with a bob', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  const game = createFlightGame({ id: 't-flight' }, { scene, camera });
  const sim = game.systems[0];
  const world = { playing: true } as never;
  const stats = () => game.stats() as { x: number; y: number; z: number; time: number };

  try {
    for (let f = 0; f < 600; f++) sim.update(1 / 60, world); // 10s
    const s = stats();
    assert.ok(s.time > 9, `advanced ~10s (got ${s.time.toFixed(1)})`);
    const r = Math.hypot(s.x, s.z);
    assert.ok(Math.abs(r - 30) < 0.5, `horizontal radius ~30 (got ${r.toFixed(1)})`);
    assert.ok(s.y >= 6 && s.y <= 14, `altitude within 10±4 (got ${s.y.toFixed(1)})`);
  } finally {
    game.dispose();
  }
});
