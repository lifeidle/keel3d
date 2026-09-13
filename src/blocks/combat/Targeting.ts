/**
 * Targeting — pick an enemy by strategy. Pure function + helper class.
 */

export interface TargetCandidate {
  x: number;
  z: number;
  alive?: boolean;
}

export type TargetMode = 'nearest' | 'lowestHp' | 'first';

export interface TargetOpts {
  range?: number;
  mode?: TargetMode;
  /** Optional facing filter: dot(dir, toTarget) >= minDot */
  facingX?: number;
  facingZ?: number;
  minDot?: number;
}

export function pickTarget<T extends TargetCandidate>(
  fromX: number,
  fromZ: number,
  list: readonly T[],
  hpOf?: (t: T) => number,
  opts: TargetOpts = {},
): T | null {
  const range = opts.range ?? Infinity;
  let best: T | null = null;
  let bestScore = Infinity;

  for (const t of list) {
    if (t.alive === false) continue;
    const dx = t.x - fromX;
    const dz = t.z - fromZ;
    const d = Math.hypot(dx, dz);
    if (d > range) continue;
    if (opts.minDot != null && opts.facingX != null && opts.facingZ != null && d > 1e-4) {
      const dot = (dx / d) * opts.facingX + (dz / d) * opts.facingZ;
      if (dot < opts.minDot) continue;
    }
    const mode = opts.mode ?? 'nearest';
    const score =
      mode === 'lowestHp' ? (hpOf ? hpOf(t) : 0) + d * 0.001 : d;
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}
