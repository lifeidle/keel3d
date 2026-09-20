/**
 * nearestPoint — deterministic nearest-of-points (R92). Pure.
 *
 * Gap: "closest target within a radius" appears in every shooter/locator,
 * and content implementations DIVERGE: first-in-array-within-radius (wrong
 * when two targets sit near the ray) vs true-nearest; `<` vs `<=`; tie
 * handling. One pure form: TRUE nearest, inclusive `maxDist` threshold,
 * ties go to the EARLIER index, −1 when nothing qualifies.
 */
export interface XZ {
  x: number;
  z: number;
}

/**
 * Index of the point in `pts` nearest to (px, pz), or −1 when no point is
 * within `maxDist` (inclusive) or `pts` is empty. Ties → earlier index.
 */
export function nearestPoint(
  px: number,
  pz: number,
  pts: readonly XZ[],
  maxDist: number,
): number {
  if (!Number.isFinite(px) || !Number.isFinite(pz)) {
    throw new Error('nearestPoint: px/pz must be finite');
  }
  if (!Number.isFinite(maxDist) || maxDist < 0) {
    throw new Error('nearestPoint: maxDist must be finite and >= 0');
  }
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) {
      throw new Error('nearestPoint: point coordinates must be finite');
    }
    const d = Math.hypot(p.x - px, p.z - pz);
    // strict < on distance (ties → earlier index wins) + inclusive threshold
    if (d < bestD && d <= maxDist) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
