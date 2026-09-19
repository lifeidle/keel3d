import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blastContains,
  blastDamageAt,
  blastRing,
  blastHits,
  type BlastConfig,
} from '../src/blocks/combat/Blast';

/**
 * R80 — Blast presentation layer (point-mode damage, containment, ring
 * points) consistent with the target-mode blastHits curve.
 */

const CFG: BlastConfig = { radius: 4, damage: 40, falloff: 0.9 };

test('blastContains: inside / boundary / outside', () => {
  assert.equal(blastContains(0, 0, 0, 0, 4), true, 'center');
  assert.equal(blastContains(0, 0, 3, 0, 4), true, 'inside');
  assert.equal(blastContains(0, 0, 4, 0, 4), true, 'boundary included');
  assert.equal(blastContains(0, 0, 4.001, 0, 4), false, 'just outside');
  assert.equal(blastContains(0, 0, 0, 5, 4), false, 'diagonal-ish outside');
});

test('blastDamageAt: center full, edge scaled, outside zero, flat falloff', () => {
  assert.equal(blastDamageAt(0, 0, 0, 0, CFG), 40, 'center = full');
  assert.equal(blastDamageAt(0, 0, 4, 0, CFG), 4, 'edge = 40 * (1 - 0.9)');
  assert.equal(blastDamageAt(0, 0, 2, 0, CFG), Math.round(40 * (1 - 0.5 * 0.9)), 'midpoint');
  assert.equal(blastDamageAt(0, 0, 9, 0, CFG), 0, 'outside');
  assert.equal(blastDamageAt(0, 0, 4, 0, { ...CFG, falloff: 0 }), 40, 'falloff 0 = flat');
});

test('blastRing: closed loop of `segments` points at the radius', () => {
  const pts = blastRing(1, -2, 3, 12);
  assert.equal(pts.length, 12);
  for (const [x, z] of pts) {
    assert.ok(Math.hypot(x - 1, z + 2) - 3 < 1e-9, `point at radius (got ${Math.hypot(x - 1, z + 2)})`);
  }
  assert.deepEqual(pts[0], [1 + 3, -2], 'point 0 at angle 0');
  assert.throws(() => blastRing(0, 0, 3, 2), /segments/);
});

test('blastDamageAt agrees with blastHits at the same positions', () => {
  const hits = blastHits(0, 0, [
    { x: 0, z: 0, alive: true, collider: 'a' },
    { x: 3, z: 0, alive: true, collider: 'b' },
    { x: 4, z: 0, alive: true, collider: 'c' },
    { x: 9, z: 0, alive: true, collider: 'd' },
  ], CFG);
  for (const h of hits) {
    assert.equal(
      h.damage,
      blastDamageAt(0, 0, h.target.x, h.target.z, CFG),
      `damage agrees at (${h.target.x},${h.target.z})`,
    );
  }
});
