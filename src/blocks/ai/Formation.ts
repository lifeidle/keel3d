/**
 * Formation — V-formation slot positions (R99). Pure.
 *
 * Gap: "where should unit i stand relative to the leader" appears in every
 * squad / escort / follow system — content hand-rolls triangle/line math
 * with per-unit offsets and yaw rotation, and allies collapse onto a
 * single follow point. One pure form: slots assigned by INDEX (stable
 * identity), laid out as a V (wedge) behind the leader, rotated by the
 * leader's heading.
 */
export interface FormationSlot {
  x: number;
  z: number;
}

export interface FormationOpts {
  /** Lateral offset of the first-row flanks (u). Default 1.6. */
  spread?: number;
  /** Rearward distance of the first row (u). Default 2.2. */
  back?: number;
  /** Extra rearward distance per row (u). Default 1.8. */
  rowStep?: number;
}

/**
 * Slot i (0-based, in assignment order) of a V formation behind the
 * leader at (lx, lz) facing heading `heading` (world yaw; forward =
 * (−sin h, −cos h) per the yexi convention):
 * - row = floor(i / 2), side = i % 2 === 0 ? +1 : −1 (alternating flanks,
 *   same row pairs);
 * - rear distance = back + row · rowStep;
 * - lateral = side · spread (constant across rows — a narrow V).
 * n = 0 → []. The leader's own position is NOT a slot (content places the
 * leader).
 */
export function vFormation(
  lx: number,
  lz: number,
  heading: number,
  n: number,
  opts: FormationOpts = {},
): FormationSlot[] {
  if (!Number.isFinite(lx) || !Number.isFinite(lz) || !Number.isFinite(heading)) {
    throw new Error('vFormation: leader position and heading must be finite');
  }
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
    throw new Error('vFormation: n must be a non-negative integer');
  }
  const spread = opts.spread ?? 1.6;
  const back = opts.back ?? 2.2;
  const rowStep = opts.rowStep ?? 1.8;
  if (spread < 0 || back < 0 || rowStep < 0) {
    throw new Error('vFormation: opts must be >= 0');
  }
  const out: FormationSlot[] = [];
  const sx = Math.sin(heading);
  const cz = Math.cos(heading);
  // rear unit = + (sin h, cos h) (forward is −(sin h, cos h));
  // lateral unit = + (cos h, −sin h)
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? 1 : -1;
    const r = back + row * rowStep;
    const lat = side * spread;
    out.push({
      x: lx + sx * r + cz * lat,
      z: lz + cz * r - sx * lat,
    });
  }
  return out;
}
