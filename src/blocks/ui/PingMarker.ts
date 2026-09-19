/**
 * PingMarker — transient map pings (R73).
 *
 * Gap: RTS/stealth staples — a transient circle at a map position that
 * grows and fades over a few seconds (wave spawn alert, objective ping,
 * "drop landed here"). The clock math is pure (monotonic-seconds input,
 * caller advances it); each ping carries a remaining fraction (1 → 0) so
 * the consumer can drive radius/opacity however it likes.
 * Headless-safe: no DOM involved.
 */
export interface PingSample {
  x: number;
  z: number;
  /** Remaining fraction of the ping's life (1 just after a ping → 0 at expiry). */
  fraction: number;
  /** Content identity ('wave' / 'ally' …) — set via `PingOpts.tag`. */
  tag?: string;
}

export interface PingOpts {
  /** Seconds the ping lives. Default 3. */
  life?: number;
  /** Content identity carried into `active()` samples (render dispatch). */
  tag?: string;
}

export class PingMarker {
  private pings: { x: number; z: number; born: number; life: number; tag?: string }[] = [];

  /**
   * Add a ping at (x, z) at clock time `t`. `lifeOrOpts` is a number of
   * seconds (back-compat) or `PingOpts` ({life?, tag?}).
   */
  ping(x: number, z: number, t: number, lifeOrOpts: number | PingOpts = 3): void {
    const life = typeof lifeOrOpts === 'number' ? lifeOrOpts : lifeOrOpts.life ?? 3;
    const tag = typeof lifeOrOpts === 'number' ? undefined : lifeOrOpts.tag;
    if (!Number.isFinite(life) || life <= 0) {
      throw new Error('PingMarker: life must be finite and > 0');
    }
    this.pings.push({ x, z, born: t, life, tag });
  }

  /**
   * Active pings at clock `t`, oldest (lowest fraction) first.
   * Only EXPIRED pings are pruned as a side effect (the list never grows
   * unbounded); pings not yet born stay stored but are not active.
   */
  active(t: number): PingSample[] {
    this.pings = this.pings.filter((p) => t - p.born < p.life);
    return this.pings
      .filter((p) => t >= p.born)
      .map((p) => {
        const f = 1 - (t - p.born) / p.life;
        return { x: p.x, z: p.z, fraction: Math.max(0, Math.min(1, f)), tag: p.tag };
      })
      .sort((a, b) => a.fraction - b.fraction);
  }

  /** Number of unexpired pings (cheap — pruned on the last `active` call). */
  get size(): number {
    return this.pings.length;
  }
}
