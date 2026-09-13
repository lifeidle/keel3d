/**
 * AreaDamage — sphere / ring damage query. Pure function.
 */

export interface AreaTarget {
  x: number;
  z: number;
  alive?: boolean;
  ref?: unknown;
}

export interface AreaResult<T extends AreaTarget> {
  target: T;
  distance: number;
}

/** Targets inside a sphere (XZ + optional Y). */
export function areaHits<T extends AreaTarget>(
  cx: number,
  cz: number,
  radius: number,
  list: readonly T[],
  cy = 0,
  ignore?: (t: T) => boolean,
): AreaResult<T>[] {
  const out: AreaResult<T>[] = [];
  for (const t of list) {
    if (t.alive === false) continue;
    if (ignore && ignore(t)) continue;
    const d = Math.hypot(t.x - cx, t.z - cz);
    if (d <= radius) out.push({ target: t, distance: d });
  }
  void cy;
  return out;
}

/** Ring (donut): minR < dist <= maxR. */
export function ringHits<T extends AreaTarget>(
  cx: number,
  cz: number,
  minR: number,
  maxR: number,
  list: readonly T[],
): AreaResult<T>[] {
  return areaHits(cx, cz, maxR, list).filter((h) => h.distance > minR);
}
