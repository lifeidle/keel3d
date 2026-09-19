/**
 * Trail — fading position history (R84). Pure, headless-testable.
 *
 * Gap: projectile arcs (nade/flares) and moving markers need a short
 * position trail (where the thing HAS BEEN). Content samples positions
 * (distance-gated so sparse motion stays sparse), and `active(t)` returns
 * live points with a 1 → 0 fraction for opacity/size ramps. Expired points
 * are pruned as a side effect (the list never grows unbounded) — same
 * pattern family as PingMarker/WindowBar.
 */
export interface TrailOpts {
  /** Max points retained (newest kept, oldest evicted). Default 12. */
  capacity?: number;
  /** Minimum world distance from the last accepted point. Default 0.25. */
  minStep?: number;
  /** Point lifetime in seconds (fraction 1 → 0 over it). Default 0.6. */
  life?: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  z: number;
  /** Elapsed fraction 1 → 0 over the point's life. */
  fraction: number;
}

export class Trail {
  private pts: { x: number; y: number; z: number; born: number }[] = [];
  private last: { x: number; y: number; z: number } | null = null;
  private capacity: number;
  private minStep: number;
  private life: number;

  constructor(opts: TrailOpts = {}) {
    this.capacity = opts.capacity ?? 12;
    this.minStep = opts.minStep ?? 0.25;
    this.life = opts.life ?? 0.6;
    if (!(this.capacity >= 1)) throw new Error('Trail: capacity must be >= 1');
    if (!(this.minStep >= 0)) throw new Error('Trail: minStep must be >= 0');
    if (!Number.isFinite(this.life) || this.life <= 0) {
      throw new Error('Trail: life must be finite and > 0');
    }
  }

  /**
   * Sample a position at clock time `t`. Distance-gated: samples closer
   * than `minStep` to the last ACCEPTED point are skipped (a stationary
   * object leaves no trail).
   */
  add(x: number, y: number, z: number, t: number): void {
    if (this.last) {
      const d = Math.hypot(x - this.last.x, y - this.last.y, z - this.last.z);
      if (d < this.minStep) return;
    }
    this.pts.push({ x, y, z, born: t });
    this.last = { x, y, z };
    if (this.pts.length > this.capacity) this.pts.shift();
  }

  /**
   * Live points at clock `t`, oldest first. Only EXPIRED points are pruned
   * as a side effect.
   */
  active(t: number): TrailPoint[] {
    this.pts = this.pts.filter((p) => t - p.born < this.life);
    return this.pts.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z,
      fraction: Math.max(0, Math.min(1, 1 - (t - p.born) / this.life)),
    }));
  }

  /** Number of unexpired points (cheap — pruned on the last `active`). */
  get size(): number {
    return this.pts.length;
  }

  clear(): void {
    this.pts = [];
    this.last = null;
  }
}
