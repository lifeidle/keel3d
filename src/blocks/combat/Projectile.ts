/**
 * Projectile — straight-line shot with lifetime. Pure logic.
 * Caller owns meshes; this only integrates position and reports hits.
 */
export interface ProjectileOpts {
  x: number;
  z: number;
  y?: number;
  dx: number;
  dz: number;
  speed: number;
  damage: number;
  /** Seconds before auto-despawn. */
  life?: number;
  /** Optional owner tag to ignore. */
  owner?: string;
}

export interface ProjectileHit<T = unknown> {
  target: T;
  damage: number;
  x: number;
  z: number;
}

export class Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  life: number;
  owner: string;
  alive = true;

  constructor(o: ProjectileOpts) {
    this.x = o.x;
    this.y = o.y ?? 0.5;
    this.z = o.z;
    const len = Math.hypot(o.dx, o.dz) || 1;
    this.vx = (o.dx / len) * o.speed;
    this.vz = (o.dz / len) * o.speed;
    this.damage = o.damage;
    this.life = o.life ?? 3;
    this.owner = o.owner ?? '';
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  kill(): void {
    this.alive = false;
  }
}

export interface HitTestTarget<T> {
  x: number;
  z: number;
  radius?: number;
  alive?: boolean;
  tag?: string;
  ref: T;
}

/** Advance projectiles and test sphere hits; returns hit list. */
export function stepProjectiles<T>(
  projectiles: Projectile[],
  targets: readonly HitTestTarget<T>[],
  dt: number,
  hitRadius = 0.6,
): ProjectileHit<T>[] {
  const hits: ProjectileHit<T>[] = [];
  for (const p of projectiles) {
    if (!p.alive) continue;
    p.update(dt);
    if (!p.alive) continue;
    for (const t of targets) {
      if (t.alive === false) continue;
      if (t.tag && t.tag === p.owner) continue;
      const r = (t.radius ?? 0.5) + hitRadius;
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      if (dx * dx + dz * dz <= r * r) {
        hits.push({ target: t.ref, damage: p.damage, x: p.x, z: p.z });
        p.kill();
        break;
      }
    }
  }
  // compact dead
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (!projectiles[i].alive) projectiles.splice(i, 1);
  }
  return hits;
}
