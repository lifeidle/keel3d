import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArcProjectile, arcVelocityToward } from '../src/blocks/combat/ArcProjectile';

const step = (p: ArcProjectile, dt = 0.016, n = 60) => {
  for (let i = 0; i < n; i++) p.update(dt);
};

test('parabola: rises then falls (symmetric with equal speeds)', () => {
  const p = new ArcProjectile({ x: 0, y: 1, z: 0, vx: 0, vy: 10, vz: 0, gravity: 10, life: 10 });
  let maxY = 0;
  let peakX = 0;
  for (let i = 0; i < 240; i++) {
    p.update(0.05);
    if (p.y > maxY) {
      maxY = p.y;
      peakX = i;
    }
    if (!p.alive && p.landed) break;
  }
  assert.ok(maxY > 1, `rose above start (${maxY})`);
  // peak at ~ vy/g = 1s → step 20
  assert.ok(Math.abs(peakX - 20) <= 3, `peak near t=1s (step ${peakX})`);
  assert.equal(p.landed, true);
  assert.equal(p.y, 0);
});

test('free fall from rest: y = y0 - ½gt² (approx after n steps)', () => {
  const g = 20;
  const p = new ArcProjectile({ x: 0, y: 10, z: 0, vx: 0, vy: 0, vz: 0, gravity: g, groundY: 0, life: 30 });
  const dt = 0.01;
  const n = 100; // t = 1s → y ≈ 10 - 10 = 0 (lands exactly at ~1s)
  for (let i = 0; i < n; i++) p.update(dt);
  assert.ok(p.landed || p.y < 0.5, `fell (y=${p.y}, landed=${p.landed})`);
});

test('horizontal velocity is constant (gravity only affects y)', () => {
  const p = new ArcProjectile({ x: 0, y: 20, z: 0, vx: 8, vy: 0, vz: 0, gravity: 20, groundY: 0, life: 30 });
  for (let i = 0; i < 50; i++) p.update(0.02); // t=1s (lands at t≈1.414s, still alive)
  assert.equal(p.vx, 8);
  assert.ok(p.alive, 'still in flight at t=1s');
  assert.ok(Math.abs(p.x - 8) < 0.2, `x ≈ 8 after 1s (${p.x})`);
});

test('life expiry despawns', () => {
  const p = new ArcProjectile({ x: 0, y: 5, z: 0, vx: 0, vy: 0, vz: 0, gravity: 1, life: 0.5, groundY: -100 });
  for (let i = 0; i < 60; i++) p.update(0.02); // 1.2s
  assert.equal(p.alive, false);
  assert.equal(p.landed, false); // died by age, not landing
});

test('kill() force-despawns', () => {
  const p = new ArcProjectile({ x: 0, y: 5, z: 0, vx: 1, vy: 1, vz: 0, gravity: 10, life: 30 });
  p.kill();
  assert.equal(p.alive, false);
  p.update(0.1); // no-op after kill
  assert.equal(p.x, 0);
});

test('arcVelocityToward: toss lands near the target', () => {
  const from = { x: 0, y: 2, z: 0 };
  const to = { x: 10, z: 0 };
  const g = 14;
  const v = arcVelocityToward(from, to, { gravity: g, heightDelta: -2, time: 1.4 });
  const p = new ArcProjectile({
    x: from.x, y: from.y, z: from.z,
    vx: v.vx, vy: v.vy, vz: v.vz,
    gravity: g, groundY: 0, life: 10,
  });
  let maxErr = Infinity;
  for (let i = 0; i < 400 && p.alive; i++) {
    p.update(0.025);
    if (p.landed) break;
  }
  const err = Math.hypot(p.x - to.x, p.z - to.z);
  assert.ok(err < 1.5, `landed near target (err ${err.toFixed(2)})`);
});

test('arcVelocityToward: zero-distance guard (no NaN)', () => {
  const v = arcVelocityToward({ x: 0, y: 1, z: 0 }, { x: 0, z: 0 }, { gravity: 10 });
  assert.ok(Number.isFinite(v.vx));
  assert.ok(Number.isFinite(v.vy));
});
