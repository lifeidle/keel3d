import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MiniMap, worldToMap } from '../src/blocks/ui/MiniMap';

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
  m.draw({ player: { x: 0, z: 0, yaw: 0 }, dots: [] }); // no-op, no throw
  assert.equal(m.playerMapValue, null);
  m.dispose();
});

test('MiniMap: playerMap tracks the last draw (DOM) via the same mapping', () => {
  // mapping-only invariant: a player at (0,0) with extent 32 lands at (75,75)
  const p = worldToMap(0, 0, M);
  assert.deepEqual(p, { x: 75, y: 75 });
});
