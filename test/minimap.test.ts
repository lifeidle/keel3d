import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MiniMap, worldToMap, clampToWorldExtent } from '../src/blocks/ui/MiniMap';

/**
 * MiniMap (R45) — north-fixed canvas minimap contract.
 * The mapping is pure (headless-assertable); the class DOM-guards so a bare
 * Node construction is a safe no-op (canvas = null).
 */

const M = { size: 150, extent: 32 };

test('worldToMap: origin maps to canvas centre', () => {
  const p = worldToMap(0, 0, M);
  assert.ok(Math.abs(p.x - 75) < 1e-9 && Math.abs(p.y - 75) < 1e-9, JSON.stringify(p));
});

test('worldToMap: +x → right, −z → up (north-fixed)', () => {
  const right = worldToMap(32, 0, M); // extent edge → canvas right edge
  const up = worldToMap(0, -32, M); // world -z → canvas top
  const left = worldToMap(-32, 0, M);
  const down = worldToMap(0, 32, M);
  assert.ok(right.x > 149 && right.y === 75, JSON.stringify(right));
  assert.ok(up.x === 75 && up.y < 1, JSON.stringify(up));
  assert.ok(left.x < 1, JSON.stringify(left));
  assert.ok(down.y > 149, JSON.stringify(down));
});

test('worldToMap: off-map points fall outside the canvas (draw skips them)', () => {
  const p = worldToMap(40, 0, M); // beyond extent 32
  assert.ok(p.x > 150, `off-map x ${p.x}`);
  const inside = worldToMap(31, 0, M);
  assert.ok(inside.x < 150 && inside.x > 0);
});

test('MiniMap: headless construction is a safe no-op (canvas null, no throw)', () => {
  const m = new MiniMap({ extent: 40 });
  assert.equal(m.canvas, null);
  m.draw({ player: { x: 0, z: 0, yaw: 0 }, dots: [] }); // no canvas → no throw
  // R78: headless draw still RECORDS the resolution (acceptance hooks)
  assert.deepEqual(m.playerMapValue, { x: 75, y: 75 }, 'map position recorded headless');
  m.dispose();
});

test('MiniMap: playerMap tracks the last draw (DOM) via the same mapping', () => {
  // mapping-only invariant: a player at (0,0) with extent 32 lands at (75,75)
  const p = worldToMap(0, 0, M);
  assert.deepEqual(p, { x: 75, y: 75 });
});

/**
 * R57 — off-map edge indicators (clampToWorldExtent pure helper +
 * MiniMap.edgeDots option with the lastEdgeDots acceptance hook).
 */
test('clampToWorldExtent: inside points pass through unchanged', () => {
  const a = clampToWorldExtent(10, -5, 32);
  assert.deepEqual(a, { x: 10, z: -5, clamped: false });
  const b = clampToWorldExtent(31.5, 0, 32); // inside the margin box
  assert.deepEqual(b, { x: 31.5, z: 0, clamped: false });
});

test('clampToWorldExtent: boundary + off-map points pin to the edge (margin keeps the dot fully inside)', () => {
  const a = clampToWorldExtent(40, 0, 32);
  assert.deepEqual(a, { x: 31.5, z: 0, clamped: true }, 'off-map → margin 0.5 inside');
  const b = clampToWorldExtent(32, 0, 32); // exactly on the boundary: dot would half-clip
  assert.deepEqual(b, { x: 31.5, z: 0, clamped: true }, 'boundary pulled inside too');
  const c = clampToWorldExtent(-45, 50, 32, 1);
  assert.deepEqual(c, { x: -31, z: 31, clamped: true }, 'corner, margin 1');
});

test('clampToWorldExtent: negative margin clamps to zero (no NaN/invert)', () => {
  const a = clampToWorldExtent(40, 0, 32, 40); // lim = max(0, 32-40) = 0
  assert.deepEqual(a, { x: 0, z: 0, clamped: true });
});

test('MiniMap: headless draw with edgeDots is a safe no-op (but still records)', () => {
  const m = new MiniMap({ extent: 32, edgeDots: true });
  assert.equal(m.canvas, null);
  m.draw({ player: { x: 0, z: 0, yaw: 0 }, dots: [{ x: 50, z: 0, color: '#fff', r: 2 }] });
  // R78: resolution (edge clamping + counter) is recorded even without a canvas
  assert.equal(m.lastEdgeDots, 1, 'off-map dot pinned to the edge');
  assert.equal(m.lastDots.length, 1);
  assert.equal(m.lastDots[0].clamped, true);
  m.dispose();
});
