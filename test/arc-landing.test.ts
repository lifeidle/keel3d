import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArcProjectile,
  arcLandingPoint,
  arcVelocityToward,
} from '../src/blocks/combat/ArcProjectile';

/**
 * R85 — arcLandingPoint (closed-form landing prediction).
 */

test('flat ground: exact closed form', () => {
  // from (0,1,0), v=(4,4,0), g=8, ground 0:
  // y(t) = 1 + 4t − 4t² = 0 → t = (4 + √32)/8 ≈ 1.20711
  const r = arcLandingPoint({ x: 0, y: 1, z: 0 }, { vx: 4, vy: 4, vz: 0 }, { gravity: 8, groundY: 0 });
  assert.ok(Math.abs(r.time! - 1.20711) < 1e-3, `time (got ${r.time})`);
  assert.ok(Math.abs(r.x - 4 * 1.20711) < 1e-2, `x (got ${r.x})`);
  assert.ok(Math.abs(r.y) < 1e-9, 'lands on the plane');
});

test('already below ground with downward speed: immediate contact', () => {
  const r = arcLandingPoint({ x: 0, y: -0.1, z: 0 }, { vx: 2, vy: -1, vz: 0 }, { gravity: 10, groundY: 0 });
  assert.equal(r.time, 0, 'contact now');
  assert.equal(r.x, 0, 'lands where it is');
});

test('terrain groundFn: fixed point lands ON the ground', () => {
  // gentle slope rising in +x: flat prediction lands at x≈4.33 where
  // ground ≈ 0.22 → lands slightly EARLIER (smaller x) than flat ground
  const flat = arcLandingPoint({ x: 0, y: 1, z: 0 }, { vx: 4, vy: 4, vz: 0 }, { gravity: 8, groundY: 0 });
  const slope = (x: number, _z: number) => 0.5 * (x / 10);
  const r = arcLandingPoint({ x: 0, y: 1, z: 0 }, { vx: 4, vy: 4, vz: 0 }, { gravity: 8, groundFn: slope });
  assert.ok(r.time! > 0);
  assert.ok(r.x < flat.x, `earlier than flat (${r.x} < ${flat.x})`);
  assert.ok(Math.abs(r.y - slope(r.x, r.z)) < 0.05, `on the ground (y=${r.y}, ground=${slope(r.x, r.z)})`);
});

test('prediction matches the ArcProjectile simulation (flat)', () => {
  // semi-implicit Euler at 60fps: drift is small on a 1s arc
  const from = { x: 2, y: 1.4, z: -3 };
  const v = arcVelocityToward(from, { x: 14, z: 5 }, { gravity: 14, time: 1.1, heightDelta: -1.4 });
  const groundY = 0;
  const pred = arcLandingPoint(from, v, { gravity: 14, groundY });
  const p = new ArcProjectile({ ...from, ...v, gravity: 14, groundY, life: 8 });
  const dt = 1 / 60;
  let t = 0;
  while (p.alive && !p.landed && t < 5) {
    p.update(dt);
    t += dt;
  }
  assert.ok(p.landed, 'sim landed');
  assert.ok(
    Math.hypot(p.x - pred.x, p.z - pred.z) < 0.15,
    `sim (${p.x.toFixed(2)},${p.z.toFixed(2)}) vs pred (${pred.x.toFixed(2)},${pred.z.toFixed(2)})`,
  );
});

test('validation: gravity must be positive', () => {
  assert.throws(
    () => arcLandingPoint({ x: 0, y: 1, z: 0 }, { vx: 1, vy: 1, vz: 0 }, { gravity: 0 }),
    /gravity/,
  );
});
