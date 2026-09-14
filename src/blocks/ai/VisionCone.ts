/**
 * VisionCone — can a viewer see a point within FOV/range? Pure math.
 */
export interface VisionOpts {
  /** radians, full cone width. Default PI/2 */
  fov?: number;
  range?: number;
}

/** Returns true if target is inside the cone. Occlusion ray optional via callback. */
export function canSee(
  fromX: number,
  fromZ: number,
  yaw: number,
  toX: number,
  toZ: number,
  opts: VisionOpts = {},
  occluded?: (x1: number, z1: number, x2: number, z2: number) => boolean,
): boolean {
  const fov = opts.fov ?? Math.PI / 2;
  const range = opts.range ?? 20;
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);
  if (dist > range || dist < 0.01) return false;
  // yaw 0 faces -Z
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const dot = (dx * fx + dz * fz) / dist;
  const ang = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (ang > fov / 2) return false;
  if (occluded?.(fromX, fromZ, toX, toZ)) return false;
  return true;
}
