/**
 * SlopeSteer — pure slope-aware direction steering (R58). Headless-testable.
 *
 * Gap: a slope *speed* penalty (Slope block) makes an entity slow down on
 * climbs, but it still walks straight into steep ground. Detouring needs a
 * direction search: rotate the desired direction through a few candidate
 * angles, score each by the local climb ratio (height sampler), and pick
 * the gentlest one — preferring the smallest turn when climbs tie, so flat
 * ground keeps the exact desired heading.
 */

import { climbRatio } from './Slope';

export interface SteerOpts {
  /** Candidate angles around the desired direction (degrees). */
  angles?: number[];
  /** Sampling distance (world units) for each candidate's climb. */
  step?: number;
  /**
   * Only steer when the DIRECT direction's climb exceeds this threshold.
   * Below it, the desired direction is kept even if a rotated candidate is
   * slightly gentler — hysteresis that stops entities weaving on long
   * gentle slopes.
   */
  maxClimb?: number;
}

export interface SteerResult {
  /** Unit direction to move (desired direction when no detour is needed). */
  x: number;
  z: number;
  /** Climb ratio of the chosen direction (positive = uphill). */
  climb: number;
  /** True when a rotated candidate beat the desired direction. */
  steered: boolean;
}

const DEFAULT_ANGLES = [0, -50, 50, -25, 25];

/**
 * Pick the gentlest direction among `desired` rotated by each candidate
 * angle. Deterministic: ties (within 1e-9) prefer the smaller |angle|;
 * zero-length desired → {x:0, z:0, climb:0, steered:false}.
 */
export function steerAroundSlope(
  pos: { x: number; z: number },
  desired: { x: number; z: number },
  h: (x: number, z: number) => number,
  opts: SteerOpts = {},
): SteerResult {
  const d = Math.hypot(desired.x, desired.z);
  if (d < 1e-6) return { x: 0, z: 0, climb: 0, steered: false };
  const angles = opts.angles ?? DEFAULT_ANGLES;
  const step = opts.step ?? 1.0;
  const base = Math.atan2(desired.x, desired.z); // matches yexi yaw convention

  // hysteresis gate: gentle direct path → go straight (no weaving)
  const direct = { x: Math.sin(base), z: Math.cos(base) };
  const directClimb = climbRatio(
    pos,
    { x: pos.x + direct.x * step, z: pos.z + direct.z * step },
    h,
  );
  if (opts.maxClimb !== undefined && directClimb <= opts.maxClimb) {
    return { x: direct.x, z: direct.z, climb: directClimb, steered: false };
  }

  let bestIdx = 0;
  let bestClimb = Infinity;
  for (let i = 0; i < angles.length; i++) {
    const a = base + (angles[i] * Math.PI) / 180;
    const dir = { x: Math.sin(a), z: Math.cos(a) };
    const c = climbRatio(
      pos,
      { x: pos.x + dir.x * step, z: pos.z + dir.z * step },
      h,
    );
    // prefer lower climb; on ties keep the earlier (smaller |angle|) candidate
    if (c < bestClimb - 1e-9) {
      bestClimb = c;
      bestIdx = i;
    }
  }
  const a = base + (angles[bestIdx] * Math.PI) / 180;
  return {
    x: Math.sin(a),
    z: Math.cos(a),
    climb: bestClimb,
    steered: bestIdx !== 0,
  };
}
