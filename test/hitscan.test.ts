import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jitterDir,
  castHitscan,
  type RayCaster,
  type Vec3,
} from '../src/blocks/combat/Hitscan';

/**
 * Hitscan block tests — headless by design: the caster is duck-typed
 * (RayCaster) so no Rapier WASM is needed; `random` is injected for
 * deterministic spread behaviour.
 */

/** Deterministic LCG for reproducible spread jitter. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function angleBetween(a: Vec3, b: Vec3): number {
  const d = a.x * b.x + a.y * b.y + a.z * b.z;
  return Math.acos(Math.max(-1, Math.min(1, d)));
}

test('jitterDir: spread=0 is the exact normalized input', () => {
  const r = jitterDir({ x: 0, y: 0, z: -3 }, 0, seeded(1));
  assert.deepEqual(r, { x: 0, y: 0, z: -1 });
  const r2 = jitterDir({ x: 1, y: 2, z: 0 }, 0, seeded(2));
  const l = Math.hypot(r2.x, r2.y, r2.z);
  assert.ok(Math.abs(l - 1) < 1e-12, `not unit: ${l}`);
});

test('jitterDir: jittered direction stays unit and within the cone', () => {
  const base: Vec3 = { x: 0, y: 0, z: -1 };
  for (let seed = 1; seed <= 64; seed++) {
    const r = jitterDir(base, 0.2, seeded(seed));
    const len = Math.hypot(r.x, r.y, r.z);
    assert.ok(Math.abs(len - 1) < 1e-9, `not unit: ${len}`);
    const ang = angleBetween(base, r);
    assert.ok(ang <= 0.2 + 1e-9, `angle ${ang} exceeds cone 0.2`);
  }
});

test('jitterDir: zero input direction is a no-op safe fallback', () => {
  const r = jitterDir({ x: 0, y: 0, z: 0 }, 0.2, seeded(7));
  assert.ok(Math.hypot(r.x, r.y, r.z) === 0, 'zero stays zero (len fallback)');
});

test('castHitscan: hit — end is the hit point, hit preserved, dir forwarded', () => {
  const seen: { origin?: Vec3; dir?: Vec3; maxToi?: number; exclude?: unknown } = {};
  const hitObj = { collider: { id: 5 } as never, toi: 12, point: { x: 3, y: 0, z: -12 }, normal: { x: 0, y: 1, z: 0 } };
  const caster: RayCaster = {
    raycast: (o, d, max, ex) => {
      seen.origin = o;
      seen.dir = d;
      seen.maxToi = max;
      seen.exclude = ex;
      return hitObj;
    },
  };
  const res = castHitscan(
    caster,
    { x: 0, y: 1.5, z: 0 },
    { x: 0, y: 0, z: -1 },
    { spread: 0, range: 50, excludeCollider: 'SHOOTER_COL' },
  );
  assert.equal(res.hit, hitObj);
  assert.deepEqual(res.end, hitObj.point);
  assert.deepEqual(seen.maxToi, 50);
  assert.equal(seen.exclude, 'SHOOTER_COL');
  assert.deepEqual(seen.dir, { x: 0, y: 0, z: -1 });
});

test('castHitscan: miss — end is origin + dir*range', () => {
  const caster: RayCaster = { raycast: () => null };
  const res = castHitscan(caster, { x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: -1 }, { spread: 0, range: 40 });
  assert.equal(res.hit, null);
  assert.deepEqual(res.end, { x: 1, y: 2, z: -37 });
});

test('castHitscan: spread jitter is applied before the cast (deterministic)', () => {
  let seenDir: Vec3 | undefined;
  const caster: RayCaster = {
    raycast: (_o, d) => {
      seenDir = { ...d };
      return null;
    },
  };
  const res = castHitscan(caster, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, {
    spread: 0.3,
    range: 10,
    random: seeded(42),
  });
  assert.ok(seenDir, 'caster was called');
  // the direction actually cast is the jittered one (and equals res.dir)
  assert.deepEqual(seenDir, res.dir);
  const ang = angleBetween({ x: 0, y: 0, z: -1 }, res.dir);
  assert.ok(ang > 0 && ang <= 0.3 + 1e-9, `expected jittered dir, angle=${ang}`);
});

test('castHitscan: excludeColliders skips listed colliders and continues the ray', () => {
  // cluster scenario: two "allies" (A, B) sit between the shooter and the
  // target; the shot must pass both and land on the target.
  const A = { id: 'A' };
  const B = { id: 'B' };
  const TARGET = { id: 'target' };
  const colliders = [
    { c: A, z: -5 },
    { c: B, z: -8 },
    { c: TARGET, z: -20 },
  ];
  let calls = 0;
  const caster: RayCaster = {
    raycast: (o, _d, max, ex) => {
      calls++;
      const cand = colliders
        .filter((h) => h.z < o.z && h.z >= o.z - max && h.c !== ex)
        .sort((a, b) => b.z - a.z); // nearest (largest z) first
      if (!cand.length) return null;
      const h = cand[0];
      return {
        collider: h.c,
        toi: o.z - h.z,
        point: { x: 0, y: 0, z: h.z },
        normal: { x: 0, y: 0, z: 1 },
      };
    },
  };
  const res = castHitscan(caster, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, {
    spread: 0,
    range: 50,
    excludeColliders: [A, B],
  });
  assert.equal(res.hit?.collider, TARGET, `expected the target, got ${res.hit?.collider?.id}`);
  assert.deepEqual(res.end, { x: 0, y: 0, z: -20 });
  assert.equal(calls, 2, 'expected one re-cast past each excluded collider');
});
