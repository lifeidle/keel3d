import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blastHits, DEFAULT_BLAST } from '../src/blocks/combat/Blast';

const t = (x: number, z: number) => ({
  collider: { id: `t${x},${z}` },
  x,
  z,
});

test('center target takes full damage', () => {
  const res = blastHits(0, 0, [t(0, 0)], { radius: 4, damage: 40, falloff: 0.9 });
  assert.equal(res.length, 1);
  assert.equal(res[0].hit, true);
  assert.equal(res[0].damage, 40);
  assert.equal(res[0].dist, 0);
});

test('edge target takes damage*(1-falloff)', () => {
  const res = blastHits(0, 0, [t(4, 0)], { radius: 4, damage: 40, falloff: 0.9 });
  assert.equal(res[0].hit, true);
  assert.equal(res[0].damage, 4); // 40 * (1 - 1*0.9)
});

test('outside radius takes nothing (reported, hit=false)', () => {
  const res = blastHits(0, 0, [t(5, 0)], { radius: 4, damage: 40, falloff: 0.9 });
  assert.equal(res[0].hit, false);
  assert.equal(res[0].damage, 0);
  assert.ok(Math.abs(res[0].dist - 5) < 1e-9);
});

test('flat falloff (0) = full damage anywhere inside', () => {
  const res = blastHits(0, 0, [t(0, 0), t(3.9, 0)], { radius: 4, damage: 30, falloff: 0 });
  assert.equal(res[0].damage, 30);
  assert.equal(res[1].damage, 30);
});

test('planar distance only — Y is not part of the target shape', () => {
  const res = blastHits(0, 0, [t(3, 0), t(0, 3)], { radius: 4, damage: 40, falloff: 0.9 });
  assert.equal(res[0].dist, 3);
  assert.equal(res[1].dist, 3);
  assert.equal(res[1].damage, res[0].damage);
});

test('distances exact; caller order preserved (3-4-5 triangle)', () => {
  const res = blastHits(0, 0, [t(0, 3), t(3, 4)], { radius: 4, damage: 40, falloff: 0.9 });
  assert.equal(res[0].dist, 3);
  assert.equal(res[1].dist, 5);
  assert.equal(res[1].hit, false); // 5 > 4
  assert.equal(res[0].hit, true);
});

test('alive=false targets are skipped (AreaDamage semantics)', () => {
  const res = blastHits(
    0,
    0,
    [t(0, 0), { ...t(0, 1), alive: false }],
    { radius: 4, damage: 40, falloff: 0.9 },
  );
  assert.equal(res.length, 1);
  assert.equal(res[0].dist, 0);
});

test('ignore filter skips targets', () => {
  const skipRef = { id: 'skip' };
  const res = blastHits(
    0,
    0,
    [{ collider: skipRef, x: 0, z: 0 }, t(1, 0)],
    { radius: 4, damage: 40, falloff: 0.9 },
    (t) => t.collider === skipRef,
  );
  // skipped target is absent; the other is reported
  assert.equal(res.length, 1);
  assert.equal(res[0].dist, 1);
});

test('DEFAULT_BLAST is sane (radius 4, damage 40, falloff 0.9)', () => {
  assert.equal(DEFAULT_BLAST.radius, 4);
  assert.equal(DEFAULT_BLAST.damage, 40);
  assert.equal(DEFAULT_BLAST.falloff, 0.9);
});
