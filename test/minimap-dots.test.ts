import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MiniMap,
  worldToMap,
} from '../src/blocks/ui/MiniMap';

/**
 * MiniMap — R78: named dots + headless-observable `lastDots`.
 */

const CFG = { size: 150, extent: 32 };
const MAP = { size: 150, extent: 32 };

test('lastDots: named dots resolved headless (id/color/r + map coords)', () => {
  const mm = new MiniMap(CFG);
  mm.draw({
    player: { x: 0, z: 0, yaw: 0 },
    dots: [
      { x: 0, z: -30, color: '#ff9a4a', r: 3.5, id: 'camp' },
      { x: 8, z: -6, color: '#ff6a5a', r: 2.5, id: 'enemy' },
      { x: 2, z: 2, color: '#58e0a0', r: 3, id: 'ally' },
    ],
  });
  const dots = mm.lastDots;
  assert.equal(dots.length, 3, 'all in-extent dots recorded');
  assert.equal(dots[0].id, 'camp');
  assert.equal(dots[0].color, '#ff9a4a');
  assert.equal(dots[0].r, 3.5);
  assert.equal(dots[2].id, 'ally');
  const expected = worldToMap(0, -30, MAP);
  assert.ok(Math.abs(dots[0].mapX - expected.x) < 1e-9, 'mapX = worldToMap');
  assert.ok(Math.abs(dots[0].mapY - expected.y) < 1e-9, 'mapY = worldToMap');
  assert.equal(dots[0].clamped, false);
  assert.deepEqual(mm.lastEdgeDots, 0);
  const exp = worldToMap(0, 0, MAP);
  assert.deepEqual(mm.playerMapValue, { x: exp.x, y: exp.y }, 'player recorded headless');
});

test('edgeDots: off-map dot pinned to the edge (clamped, counted)', () => {
  const mm = new MiniMap({ ...CFG, edgeDots: true });
  mm.draw({
    player: { x: 0, z: 0, yaw: 0 },
    dots: [{ x: 50, z: 0, color: '#fff', r: 2, id: 'far' }],
  });
  assert.equal(mm.lastDots.length, 1, 'edge dot recorded (not skipped)');
  assert.equal(mm.lastDots[0].clamped, true);
  assert.equal(mm.lastEdgeDots, 1);
  // pinned within the canvas
  const s = 150;
  assert.ok(mm.lastDots[0].mapX >= 0 && mm.lastDots[0].mapX <= s);
});

test('edgeDots default false: off-map dot is SKIPPED (back-compat)', () => {
  const mm = new MiniMap(CFG);
  mm.draw({
    player: { x: 0, z: 0, yaw: 0 },
    dots: [
      { x: 50, z: 0, color: '#fff', r: 2, id: 'far' },
      { x: 0, z: 0, color: '#000', r: 2 },
    ],
  });
  assert.equal(mm.lastDots.length, 1, 'only the in-extent dot');
  assert.equal(mm.lastDots[0].id, undefined, 'the kept dot is the in-extent one');
  assert.equal(mm.lastEdgeDots, 0);
});

test('mixed draw: in-extent + pinned dots coexist, order preserved', () => {
  const mm = new MiniMap({ ...CFG, edgeDots: true });
  mm.draw({
    player: { x: 0, z: 0, yaw: 0 },
    dots: [
      { x: 10, z: 0, color: 'a', r: 1, id: 'in' },
      { x: 60, z: 0, color: 'b', r: 1, id: 'out' },
      { x: -55, z: 0, color: 'c', r: 1, id: 'out2' },
    ],
  });
  const ids = mm.lastDots.map((d) => d.id);
  assert.deepEqual(ids, ['in', 'out', 'out2'], 'order preserved');
  assert.deepEqual(mm.lastDots.map((d) => d.clamped), [false, true, true]);
  assert.equal(mm.lastEdgeDots, 2);
});
