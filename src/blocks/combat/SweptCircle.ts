/**
 * SweptCircle — 2D swept segment-vs-circle (R95). Pure.
 *
 * Gap: fast movers (a 7 u/s tank at 30 fps moves 2.3 u per frame) can
 * PASS THROUGH a small target between frames — an instantaneous
 * "distance at the new position" check misses it. The swept form tests
 * the SEGMENT prev→current against the circle and reports closest
 * approach + where (for front-hemisphere checks / impact points).
 */
export interface SweepHit {
  /** True when the segment comes within radius `r` of the center. */
  hit: boolean;
  /** Closest distance from the segment to the circle center. */
  distance: number;
  /** Nearest point on the segment to the center (impact attribution). */
  x: number;
  z: number;
}

/**
 * Swept test: segment (px, pz) → (cx, cz) against circle (tx, tz, r).
 * A stationary mover (prev == current) degenerates to a plain distance
 * check. `t` clamps to [0, 1], so target overlap at either endpoint
 * counts as a hit.
 */
export function sweptCircle(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  tx: number,
  tz: number,
  r: number,
): SweepHit {
  if ([px, pz, cx, cz, tx, tz, r].some((v) => !Number.isFinite(v))) {
    throw new Error('sweptCircle: all coordinates and radius must be finite');
  }
  if (r < 0) throw new Error('sweptCircle: radius must be >= 0');

  const dx = cx - px;
  const dz = cz - pz;
  const lenSq = dx * dx + dz * dz;

  // parameter of the closest point on the segment to the center
  let t = 0;
  if (lenSq > 0) {
    t = ((tx - px) * dx + (tz - pz) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const x = px + t * dx;
  const z = pz + t * dz;
  const d = Math.hypot(x - tx, z - tz);
  return { hit: d <= r, distance: d, x, z };
}
