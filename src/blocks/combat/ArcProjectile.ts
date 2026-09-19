/**
 * ArcProjectile — parabolic (3D, gravity) flight. Pure logic, headless-testable.
 *
 * Complements the XZ-plane `Projectile` block: this one carries a Y
 * component, applies gravity, and reports ground landing — the mechanism
 * behind flares, grenades, and any lobbed attack. The caller owns meshes
 * and lights; this block integrates position only.
 */

export interface ArcOpts {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Downward acceleration (y decreases by gravity·dt each step). */
  gravity: number;
  /** Land when y drops to this height (default 0). */
  groundY?: number;
  /** Seconds before auto-despawn (default 6). */
  life?: number;
  /**
   * R53: fired exactly once at ground contact, with the clamped landing
   * point. Consumers stop polling `landed` for one-shot effects (SFX,
   * lights). Not called on life-expiry or kill().
   */
  onLand?: (p: { x: number; y: number; z: number }) => void;
}

export class ArcProjectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  private gravity: number;
  private groundY: number;
  private life: number;
  private onLand?: (p: { x: number; y: number; z: number }) => void;
  alive = true;
  /** True once the projectile reached groundY (position clamped there). */
  landed = false;

  constructor(o: ArcOpts) {
    this.x = o.x;
    this.y = o.y;
    this.z = o.z;
    this.vx = o.vx;
    this.vy = o.vy;
    this.vz = o.vz;
    this.gravity = o.gravity;
    this.groundY = o.groundY ?? 0;
    this.life = o.life ?? 6;
    this.onLand = o.onLand;
  }

  /** Advance one step (semi-implicit Euler — stable for game-scale arcs). */
  update(dt: number): void {
    if (!this.alive) return;
    this.vy -= this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }
    if (this.y <= this.groundY) {
      this.y = this.groundY;
      this.landed = true;
      this.alive = false;
      this.onLand?.({ x: this.x, y: this.y, z: this.z });
    }
  }

  /** Force-despawn (external collision etc.). */
  kill(): void {
    this.alive = false;
  }
}

export interface ArcLanding {
  x: number;
  y: number;
  z: number;
  /**
   * Seconds until ground contact. null = never lands (already below
   * ground with downward speed → contact is immediate, reported as 0;
   * only a horizontal shot starting exactly AT ground height with no
   * descent reports null).
   */
  time: number | null;
}

/**
 * R85 — closed-form landing prediction for an ArcProjectile flight.
 *
 * Flat plane (`groundY`): exact solve of y0 + vy·t − ½g·t² = groundY
 * (largest positive root). Terrain (`groundFn`): one fixed-point pass
 * re-solves against the ground sampled at the predicted landing —
 * converges fast on gentle terrain (≤5 iterations, 0.05u tolerance).
 *
 * Pass the SAME ground definition the ArcProjectile was constructed
 * with — a clamped constant plane lands on that plane, not on terrain.
 */
export function arcLandingPoint(
  from: { x: number; y: number; z: number },
  v: { vx: number; vy: number; vz: number },
  opts: {
    gravity: number;
    groundY?: number;
    groundFn?: (x: number, z: number) => number;
  },
): ArcLanding {
  const g = opts.gravity;
  if (!(g > 0)) throw new Error('arcLandingPoint: gravity must be > 0');
  const plane = (planeY: number): ArcLanding => {
    const dy = from.y - planeY;
    if (dy <= 0 && v.vy < 0) return { x: from.x, y: from.y, z: from.z, time: 0 };
    const disc = v.vy * v.vy + 2 * g * dy;
    if (disc < 0) return { x: from.x, y: from.y, z: from.z, time: null };
    const t = (v.vy + Math.sqrt(disc)) / g;
    if (!(t > 0)) return { x: from.x, y: from.y, z: from.z, time: null };
    const x = from.x + v.vx * t;
    const z = from.z + v.vz * t;
    return { x, y: planeY, z, time: t };
  };
  if (opts.groundFn) {
    // fixed point: plane at the current landing's ground height
    let land = plane(opts.groundFn(from.x, from.z));
    if (land.time === null) return land;
    for (let i = 0; i < 5; i++) {
      const next = plane(opts.groundFn(land.x, land.z));
      if (next.time === null) return next;
      if (Math.abs(next.x - land.x) < 0.05 && Math.abs(next.z - land.z) < 0.05) {
        return next;
      }
      land = next;
    }
    return land;
  }
  return plane(opts.groundY ?? 0);
}

/**
 * Aim helper (pure): velocity that lands a parabolic shot near a target.
 * Solves the classic toss: given horizontal distance d and height delta,
 * pick an initial vertical speed and derive the horizontal speed.
 */
export function arcVelocityToward(
  from: { x: number; y: number; z: number },
  to: { x: number; z: number },
  opts: { gravity: number; heightDelta?: number; time?: number },
): { vx: number; vy: number; vz: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  const t = opts.time ?? Math.min(2.2, Math.max(0.8, d / 10));
  const h = opts.heightDelta ?? 0;
  // y(t) = y0 + vy·t - ½g·t² = h (target height delta)
  const vy = (h + 0.5 * opts.gravity * t * t) / t;
  return {
    vx: (dx / d) * (d / t),
    vy,
    vz: (dz / d) * (d / t),
  };
}
