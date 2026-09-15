/**
 * Hitscan — generic ray-based shot / line-of-sight casting.
 *
 * Pure glue between a PhysicsWorld raycast and the content layer: spread
 * jitter + cast + terminal-point resolution. The caller decides damage,
 * VFX and sound. Block layer: no game/ imports; the caster is duck-typed
 * (`RayCaster`) so tests can mock it without Rapier WASM.
 *
 * Usage (two consumers in the wild: the yexi player weapon and yexi enemy
 * fire + LOS checks):
 *   const res = castHitscan(physics, muzzle, aimDir, {
 *     spread: 0.02, range: 150, excludeCollider: shooterCollider,
 *   });
 *   // res.hit: first hit or null · res.end: tracer end · res.dir: actual dir
 */
import type { PhysicsWorld, RayHit, Vec3 } from '../../physics/world';

/**
 * Minimum surface a caster needs. `PhysicsWorld` satisfies it; tests pass a
 * fake. `excludeCollider` is `unknown` on purpose so this block stays free of
 * a RAPIER type import (the collider is opaque to the block).
 */
export interface RayCaster {
  raycast(
    origin: Vec3,
    dir: Vec3,
    maxToi: number,
    excludeCollider?: unknown,
  ): RayHit | null;
}

export interface CastOpts {
  /** Aim cone half-angle (radians). 0 = dead aim. Default 0. */
  spread?: number;
  /** Ray length (units). Default 120. */
  range?: number;
  /** Skip one body's collider so a shot fired from inside (or near) the
   *  shooter's own capsule never hits itself. */
  excludeCollider?: unknown;
  /** Skip a LIST of colliders (e.g. all allied characters): the ray iterates
   *  past each excluded hit and continues. Needed because the caster API
   *  supports a single exclude only, and clusters (several allies in one
   *  spot) would otherwise block each other's shots and line of sight.
   *  Takes precedence over `excludeCollider` when both are given. */
  excludeColliders?: unknown[];
  /** Injectable for deterministic tests. Default Math.random. */
  random?: () => number;
}

export interface HitscanResult {
  /** First collider hit, or null when the ray expired. */
  hit: RayHit | null;
  /** Ray endpoint — the hit point, or origin + dir*range. */
  end: Vec3;
  /** The actual (jittered, unit) direction that was cast. */
  dir: Vec3;
}

/**
 * Jitter a direction within a random cone of `spread` radians around it.
 * `dir` need not be unit (normalized in the result). `random` is injected
 * for deterministic tests.
 */
export function jitterDir(
  dir: Vec3,
  spread: number,
  random: () => number = Math.random,
): Vec3 {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const dz = dir.z / len;
  if (spread <= 0) return { x: dx, y: dy, z: dz };

  const a = random() * Math.PI * 2;
  const r = spread * Math.sqrt(random());
  // basis around dir
  const up = Math.abs(dy) < 0.99 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const sx = dy * up.z - dz * up.y;
  const sy = dz * up.x - dx * up.z;
  const sz = dx * up.y - dy * up.x;
  const sl = Math.hypot(sx, sy, sz) || 1;
  const side = { x: sx / sl, y: sy / sl, z: sz / sl };
  const side2 = {
    x: dy * side.z - dz * side.y,
    y: dz * side.x - dx * side.z,
    z: dx * side.y - dy * side.x,
  };
  const ox = Math.cos(a) * r;
  const oz = Math.sin(a) * r;
  const rx = dx + side.x * ox + side2.x * oz;
  const ry = dy + side.y * ox + side2.y * oz;
  const rz = dz + side.z * ox + side2.z * oz;
  const rl = Math.hypot(rx, ry, rz) || 1;
  return { x: rx / rl, y: ry / rl, z: rz / rl };
}

/**
 * Cast a hitscan ray: jitter the aim (spread), raycast, resolve the terminal
 * point. With `excludeColliders`, hits on listed colliders are skipped and the
 * cast continues just past them (the caster API excludes one collider per
 * call, so the loop re-casts from a point 1cm beyond each excluded hit). No
 * damage/VFX here — the caller owns the outcome.
 */
export function castHitscan(
  caster: RayCaster,
  origin: Vec3,
  dir: Vec3,
  opts: CastOpts = {},
): HitscanResult {
  const spread = opts.spread ?? 0;
  const range = opts.range ?? 120;
  const random = opts.random ?? Math.random;
  const d = jitterDir(dir, spread, random);

  const skip =
    opts.excludeColliders && opts.excludeColliders.length
      ? opts.excludeColliders
      : opts.excludeCollider != null
        ? [opts.excludeCollider]
        : [];

  let o: Vec3 = { x: origin.x, y: origin.y, z: origin.z };
  let left = range;
  let hit: RayHit | null = null;
  if (skip.length === 0) {
    hit = caster.raycast(o, d, left, undefined);
  } else {
    const first = skip[0];
    for (;;) {
      hit = caster.raycast(o, d, left, first);
      if (!hit) break;
      if (!skip.includes(hit.collider)) break;
      // advance just past this excluded collider and continue
      const step = hit.toi + 0.01;
      o = { x: o.x + d.x * step, y: o.y + d.y * step, z: o.z + d.z * step };
      left = left - step;
      if (left <= 0.02) {
        hit = null;
        break;
      }
    }
  }

  const end: Vec3 = hit
    ? { ...hit.point }
    : {
        x: origin.x + d.x * range,
        y: origin.y + d.y * range,
        z: origin.z + d.z * range,
      };
  return { hit, end, dir: d };
}

/** Convenience overload for the common case: a live PhysicsWorld. */
export function hitscan(
  physics: PhysicsWorld,
  origin: Vec3,
  dir: Vec3,
  opts: CastOpts = {},
): HitscanResult {
  return castHitscan(physics, origin, dir, opts);
}
