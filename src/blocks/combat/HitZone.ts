/**
 * HitZone — world AABB zones → damage multiplier lookup (R98). Pure.
 *
 * Gap: "weak point / armor zone" damage (turret 1.5×, engine 1.3×) is
 * per-hitpoint region testing that content re-implements ad hoc with
 * hand-rolled distance/box checks. One shared form: axis-aligned boxes
 * each carrying a multiplier; the FIRST containing box wins (array
 * order = priority); no containment → 1×.
 */
export interface DamageZone {
  /** Box center. */
  x: number;
  y: number;
  z: number;
  /** Half extents. */
  hx: number;
  hy: number;
  hz: number;
  /** Damage multiplier for hits inside the box. */
  mul: number;
}

/**
 * Multiplier for a hit at (px, py, pz): the FIRST zone containing the
 * point (order = priority) wins; 1 when nothing contains it. Boundaries
 * are inclusive (a hit exactly on a face counts).
 */
export function zoneMultiplier(
  px: number,
  py: number,
  pz: number,
  zones: readonly DamageZone[],
): number {
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
    throw new Error('zoneMultiplier: hit point must be finite');
  }
  for (const z of zones) {
    if (
      Number.isFinite(z.mul) &&
      Math.abs(px - z.x) <= z.hx &&
      Math.abs(py - z.y) <= z.hy &&
      Math.abs(pz - z.z) <= z.hz
    ) {
      return z.mul;
    }
  }
  return 1;
}
