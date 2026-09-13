/**
 * Pure steering helpers (no THREE, no physics, no game types).
 * Content AI composes these; blocks never import sample code.
 */

export interface Vec2 {
  x: number;
  z: number;
}

/** Normalize XZ direction; falls back to (0,0) for zero-length. */
export function normalizeXZ(dx: number, dz: number): Vec2 {
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return { x: 0, z: 0 };
  return { x: dx / len, z: dz / len };
}

/**
 * Seek: unit direction from self toward goal, optionally stopping at `holdAt`.
 * Returns null when already inside hold distance (caller should brake).
 */
export function seekDir(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  holdAt = 0,
): Vec2 | null {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const d = Math.hypot(dx, dz);
  if (d <= holdAt) return null;
  return normalizeXZ(dx, dz);
}

/**
 * Flank: rotate the approach vector sideways so a squad spreads into two
 * firing lanes instead of stacking. `side` is +1 right / -1 left.
 */
export function flankDir(dirX: number, dirZ: number, side: 1 | -1 | number, amount = 0.45): Vec2 {
  const px = -dirZ * side * amount;
  const pz = dirX * side * amount;
  return normalizeXZ(dirX + px, dirZ + pz);
}

/**
 * Separation delta to push two same-side units apart when closer than `pushD`.
 * Returns the (−x, −z) nudge for A and the opposite for B.
 */
export function separationDelta(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  pushD = 1.1,
  strength = 2.2,
): { ax: number; az: number; bx: number; bz: number } | null {
  const dx = bx - ax;
  const dz = bz - az;
  const d = Math.hypot(dx, dz);
  if (d >= pushD || d < 0.001) return null;
  const k = ((pushD - d) / pushD) * strength;
  const nx = dx / d;
  const nz = dz / d;
  return { ax: -nx * k, az: -nz * k, bx: nx * k, bz: nz * k };
}

/** Clamp a velocity XZ to maxSpeed; keeps caller's Y untouched. */
export function limitSpeedXZ(vx: number, vz: number, maxSpeed: number): Vec2 {
  const s = Math.hypot(vx, vz);
  if (s <= maxSpeed || s < 1e-6) return { x: vx, z: vz };
  const k = maxSpeed / s;
  return { x: vx * k, z: vz * k };
}

/** Strafe across the firing lane (hit-dodge). */
export function strafeDir(dirX: number, dirZ: number, side: 1 | -1 | number, amount = 0.8): Vec2 {
  return {
    x: dirX + -dirZ * side * amount,
    z: dirZ + dirX * side * amount,
  };
}
