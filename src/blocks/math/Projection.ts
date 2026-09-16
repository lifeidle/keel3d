/**
 * Projection — pure world→screen projection. No three.js dependency: the
 * camera is duck-typed (position/quaternion/fov/aspect), so a THREE
 * PerspectiveCamera works as-is and headless tests can pass a fake.
 *
 * Camera convention matches three.js: looks down -Z, up +Y, `fov` is the
 * VERTICAL field of view in degrees. Pairs with blocks/ui/DamageNumber
 * (which deliberately leaves the projection to the caller).
 */
export interface V3Like {
  x: number;
  y: number;
  z: number;
}

export interface CamLike {
  position: V3Like;
  /** Unit quaternion (three.js layout). */
  quaternion: { x: number; y: number; z: number; w: number };
  /** Vertical FOV in degrees. */
  fov: number;
  aspect: number;
}

export interface ScreenPoint {
  /** Pixel x in [0, vw] (clamped past the edges when off-screen). */
  x: number;
  /** Pixel y in [0, vh] (0 = top). */
  y: number;
  /** false when the point is behind (or on) the camera. */
  visible: boolean;
  /** Camera-space distance (useful for scaling or culling). */
  dist: number;
}

/** Rotate vector v by the INVERSE of unit quaternion q (v' = q̄·v·q). */
function rotateByInverse(
  q: { x: number; y: number; z: number; w: number },
  v: V3Like,
): V3Like {
  // conjugate (unit quaternions): flip the vector part
  const qx = -q.x;
  const qy = -q.y;
  const qz = -q.z;
  const qw = q.w;
  // v' = v + w*(2×(q×v)) + q×(2×(q×v))  (standard optimized sandwich)
  const tx = 2 * (qy * v.z - qz * v.y);
  const ty = 2 * (qz * v.x - qx * v.z);
  const tz = 2 * (qx * v.y - qy * v.x);
  return {
    x: v.x + qw * tx + (qy * tz - qz * ty),
    y: v.y + qw * ty + (qz * tx - qx * tz),
    z: v.z + qw * tz + (qx * ty - qy * tx),
  };
}

/**
 * Project a world point into viewport pixel coordinates.
 *
 * Returns `visible: false` when the point is behind (or within a small
 * epsilon of) the camera — callers should skip drawing then. `x`/`y` are
 * still computed (extrapolated) so callers can clamp cheaply.
 */
export function projectToScreen(
  world: V3Like,
  cam: CamLike,
  vw: number,
  vh: number,
): ScreenPoint {
  const dx = world.x - cam.position.x;
  const dy = world.y - cam.position.y;
  const dz = world.z - cam.position.z;
  // camera space
  const c = rotateByInverse(cam.quaternion, { x: dx, y: dy, z: dz });
  const dist = Math.hypot(c.x, c.y, c.z);
  // camera looks down -Z: in front means c.z < 0
  const visible = c.z < -0.05;
  const depth = -c.z;
  const focalY = 1 / Math.tan((cam.fov * 0.5 * Math.PI) / 180);
  const ndcY = depth > 0.001 ? (c.y / depth) * focalY : 0;
  const ndcX = depth > 0.001 ? (c.x / (depth * cam.aspect)) * focalY : 0;
  return {
    x: ((ndcX + 1) / 2) * vw,
    y: ((1 - ndcY) / 2) * vh,
    visible,
    dist,
  };
}
