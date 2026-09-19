import { test } from 'node:test';
import assert from 'node:assert/strict';
import { steerAroundSlope } from '../src/blocks/player/SlopeSteer';

/**
 * SlopeSteer — slope-aware direction steering (pure, headless).
 */

test('flat terrain keeps the exact desired direction', () => {
  const flat = (_x: number, _z: number) => 1;
  const r = steerAroundSlope({ x: 0, z: 0 }, { x: 5, z: 3 }, flat);
  assert.equal(r.steered, false);
  assert.ok(Math.abs(r.x - 5 / Math.hypot(5, 3)) < 1e-9);
  assert.ok(Math.abs(r.z - 3 / Math.hypot(5, 3)) < 1e-9);
  assert.equal(r.climb, 0);
});

test('steep wall ahead → detours to a flatter candidate', () => {
  // Terrain: a wall rising in +x past x=0.8 (height 10); flat below.
  // Yaw convention: dir(θ) = (sinθ, cosθ); desired +x → base θ=90°.
  // Default sample step 1.0:
  //   θ=90° (desired): sample (1, 0) → hits the wall → climb 10
  //   θ=40° / 140° (±50° offsets): sample x = sin40° ≈ 0.64 < 0.8 → flat
  //   θ=65° / 115° (±25° offsets): sample x = sin65° ≈ 0.91 > 0.8 → wall
  const h = (x: number, _z: number) => (x >= 0.8 ? 10 : 0);
  const r = steerAroundSlope({ x: 0, z: 0 }, { x: 3, z: 0 }, h);
  assert.equal(r.steered, true, 'a rotated candidate is flatter');
  // the -50° offset (θ=40°) wins — evaluated before the +50° tie
  assert.ok(Math.abs(r.x - Math.sin((40 * Math.PI) / 180)) < 1e-6, `x ${r.x}`);
  assert.ok(Math.abs(r.z - Math.cos((40 * Math.PI) / 180)) < 1e-6, `z ${r.z}`);
  assert.ok(Math.abs(r.climb) < 1e-9, `climb ${r.climb}`);
});

test('uniform radial climb (tie) keeps the desired direction', () => {
  // h = radius from the origin: from pos (0,0) every candidate samples at
  // the same radius (step) → identical climb → smallest turn wins.
  const h = (x: number, z: number) => Math.hypot(x, z);
  const r = steerAroundSlope({ x: 0, z: 0 }, { x: 4, z: 0 }, h, { step: 1.2 });
  assert.equal(r.steered, false, 'no candidate beats the desired climb');
  assert.ok(Math.abs(r.climb - 1) < 1e-9, `climb ${r.climb}`); // 1.2 / 1.2
});

test('zero-length desired vector is a safe no-op', () => {
  const r = steerAroundSlope({ x: 1, z: 1 }, { x: 0, z: 0 }, (_x, _z) => 0);
  assert.deepEqual(r, { x: 0, z: 0, climb: 0, steered: false });
});

test('direction-dependent slope: picks the genuinely flatter candidate', () => {
  // Ramp rising only along +x (0.5 per unit), desired +x (base θ=90°),
  // step 1: climb(θ) = 0.5·sinθ → θ=90°: 0.5; θ=40°/140°: 0.5·sin40°
  // ≈ 0.32 (flatter!); θ=65°/115°: 0.5·sin65° ≈ 0.45. The -50° offset
  // (θ=40°) is evaluated first among the tie → wins.
  const h = (x: number, _z: number) => 0.5 * x;
  const r = steerAroundSlope({ x: 0, z: 0 }, { x: 4, z: 0 }, h, { step: 1 });
  assert.equal(r.steered, true, '±50° candidates are genuinely flatter');
  assert.ok(Math.abs(r.x - Math.sin((40 * Math.PI) / 180)) < 1e-6, `x ${r.x}`);
  assert.ok(Math.abs(r.z - Math.cos((40 * Math.PI) / 180)) < 1e-6, `z ${r.z}`);
  assert.ok(Math.abs(r.climb - 0.5 * Math.sin((40 * Math.PI) / 180)) < 1e-9, `climb ${r.climb}`);
});

test('below maxClimb → straight even if a sideways candidate is slightly gentler', () => {
  // Ramp 0.3/unit along +x: direct climb 0.3 < maxClimb 0.35 → go straight
  // (hysteresis — no weaving on long gentle slopes).
  const h = (x: number, _z: number) => 0.3 * x;
  const r = steerAroundSlope({ x: 0, z: 0 }, { x: 4, z: 0 }, h, { step: 1, maxClimb: 0.35 });
  assert.equal(r.steered, false);
  assert.ok(Math.abs(r.climb - 0.3) < 1e-9, `climb ${r.climb}`);
});

test('maxClimb exceeded → the candidate search runs', () => {
  // Same ramp steeper: 0.5/unit → direct 0.5 > 0.35 → steers to θ=40° (0.32).
  const h = (x: number, _z: number) => 0.5 * x;
  const r = steerAroundSlope({ x: 0, z: 0 }, { x: 4, z: 0 }, h, { step: 1, maxClimb: 0.35 });
  assert.equal(r.steered, true);
  assert.ok(Math.abs(r.climb - 0.5 * Math.sin((40 * Math.PI) / 180)) < 1e-9, `climb ${r.climb}`);
});

test('custom angles are respected', () => {
  const h = (x: number, _z: number) => (x >= 1.5 ? 10 : 0);
  // only ±90° available: must take one (no straight-through option)
  const r = steerAroundSlope(
    { x: 0, z: 0 },
    { x: 3, z: 0 },
    h,
    { angles: [0, -90, 90], step: 2 },
  );
  assert.equal(r.steered, true);
  assert.ok(Math.abs(Math.abs(r.z) - 1) < 1e-9 && Math.abs(r.x) < 1e-9, `dir (${r.x}, ${r.z})`);
});
