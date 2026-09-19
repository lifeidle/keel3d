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
}

export class PingMarker {
  private pings: { x: number; z: number; born: number; life: number }[] = [];

  /** Add a ping at (x, z) at clock time `t` lasting `life` seconds. */
  ping(x: number, z: number, t: number, life = 3): void {
    if (!Number.isFinite(life) || life <= 0) {
      throw new Error('PingMarker: life must be finite and > 0');
    }
    this.pings.push({ x, z, born: t, life });
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
        return { x: p.x, z: p.z, fraction: Math.max(0, Math.min(1, f)) };
      })
      .sort((a, b) => a.fraction - b.fraction);
  }

  /** Number of unexpired pings (cheap — pruned on the last `active` call). */
  get size(): number {
    return this.pings.length;
  }
}
