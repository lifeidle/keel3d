/**
 * DustTrail — distance-gated puff emission (R91). Pure state.
 *
 * Gap: vehicles (and anything that kicks up dust/dirt) need an EMITTER
 * gated by travel DISTANCE, not time — "a puff every 0.4u travelled" —
 * with a shared puff lifetime for content-side aging. Content that rolls
 * its own `last-spawn xz` re-derives the same gating per vehicle.
 */
export interface DustPuff {
  x: number;
  y: number;
  z: number;
  /** Emission time (content clock). */
  born: number;
  /** Lifetime (seconds). */
  life: number;
}

export interface DustTrailOpts {
  /** Minimum travel distance (units) between emissions. Default 0.4. */
  interval?: number;
  /** Puff lifetime (seconds). Default 0.9. */
  life?: number;
}

export class DustTrail {
  puffs: DustPuff[] = [];
  private lastX: number | undefined;
  private lastZ: number | undefined;
  private readonly interval: number;
  private readonly life: number;

  constructor(opts: DustTrailOpts = {}) {
    this.interval = opts.interval ?? 0.4;
    this.life = opts.life ?? 0.9;
    if (!(this.interval > 0) || !Number.isFinite(this.interval)) {
      throw new Error('DustTrail: interval must be finite and > 0');
    }
    if (!(this.life > 0) || !Number.isFinite(this.life)) {
      throw new Error('DustTrail: life must be finite and > 0');
    }
  }

  /**
   * Emit a puff at (x, y, z) if the emitter travelled >= `interval` since
   * the LAST EMISSION (first call always emits). Returns true when a puff
   * was added.
   */
  add(x: number, y: number, z: number, now: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      throw new Error('DustTrail: x/z must be finite');
    }
    const lx = this.lastX;
    const lz = this.lastZ;
    if (lx !== undefined && lz !== undefined && Math.hypot(x - lx, z - lz) < this.interval) {
      return false;
    }
    this.lastX = x;
    this.lastZ = z;
    this.puffs.push({ x, y, z, born: now, life: this.life });
    return true;
  }

  /** Age + prune expired puffs. Returns the live count. */
  update(now: number): number {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]!;
      if (now - p.born >= p.life) this.puffs.splice(i, 1);
    }
    return this.puffs.length;
  }

  /** Fraction of life elapsed for a puff (0..1) — content scales/fades by it. */
  age(p: DustPuff, now: number): number {
    return (now - p.born) / p.life;
  }

  clear(): void {
    this.puffs.length = 0;
    this.lastX = undefined;
    this.lastZ = undefined;
  }
}
