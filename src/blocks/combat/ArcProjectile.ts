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
    }
  }

  /** Force-despawn (external collision etc.). */
  kill(): void {
    this.alive = false;
  }
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
