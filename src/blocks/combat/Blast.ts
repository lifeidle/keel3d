/**
 * Blast — area-of-effect DAMAGE math (pure, headless-testable).
 *
 * Sits on top of AreaDamage: `areaHits` owns the geometry (who is in
 * range, planar distance, alive/ignore filtering); this block owns the
 * distance-falloff damage curve. Recipes pass plain target lists (no
 * physics types) and get per-target damage back.
 *
 * Chaining (barrel → barrel) is recipe logic — the block stays a pure
 * math layer so it is mockable and reusable by any AoE mechanic.
 */
import { areaHits, type AreaTarget } from './AreaDamage';

/** A blast target: AreaDamage shape + opaque collider handle. */
export interface BlastTarget extends AreaTarget {
  /** Opaque collider handle (identity-compared by the caller). */
  collider: unknown;
}

export interface BlastConfig {
  /** Blast radius (world units). */
  radius: number;
  /** Damage at the center (distance 0). */
  damage: number;
  /**
   * Falloff 0..1 — how much damage is lost at the radius edge.
   * 0 = flat damage everywhere inside; 1 = linear to zero at the edge.
   */
  falloff: number;
}

export const DEFAULT_BLAST: BlastConfig = {
  radius: 4,
  damage: 40,
  falloff: 0.9,
};

export interface BlastHit {
  target: BlastTarget;
  /** Damage applied (0 when outside the radius). */
  damage: number;
  /** Planar distance from the blast origin. */
  dist: number;
  /** True when the target takes damage (inside the radius). */
  hit: boolean;
}

/**
 * Compute per-target blast damage (pure).
 *
 * Geometry comes from `areaHits` (XZ planar distance, `alive === false`
 * and `ignore` filtering respected); damage applies a linear falloff.
 * Targets outside the radius are reported with `damage: 0` so callers
 * can log/decide, but `hit` is false.
 */
export function blastHits(
  cx: number,
  cz: number,
  targets: BlastTarget[],
  cfg: BlastConfig = DEFAULT_BLAST,
  ignore?: (t: BlastTarget) => boolean,
): BlastHit[] {
  const inRange = areaHits(cx, cz, cfg.radius, targets, 0, ignore);
  const out: BlastHit[] = [];
  for (const h of inRange) {
    const f = 1 - (h.distance / cfg.radius) * cfg.falloff;
    out.push({
      target: h.target,
      damage: Math.max(0, Math.round(cfg.damage * f)),
      dist: h.distance,
      hit: true,
    });
  }
  // report out-of-range (and alive/ignored) targets with zero damage
  for (const t of targets) {
    if (t.alive === false) continue;
    if (ignore && ignore(t)) continue;
    if (!inRange.some((h) => h.target === t)) {
      out.push({ target: t, damage: 0, dist: Math.hypot(t.x - cx, t.z - cz), hit: false });
    }
  }
  return out;
}
