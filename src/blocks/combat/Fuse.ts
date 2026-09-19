/**
 * Fuse — one-shot delay timer (R59). Pure, headless-testable.
 *
 * Gap: content hand-rolls countdowns with "fires exactly once" semantics
 * (yexi barrel fuses: `b.fuseT -= dt; if (b.fuseT <= 0) explode` + a
 * boolean latch). This block owns that pattern — plus `progress` for
 * flash/SFX ramp-up and `detonate()` for early bursts (wall hits).
 */
export class Fuse {
  private t = 0;
  private fired = false;
  private armed = false;

  constructor(private delay: number) {
    if (!(this.delay >= 0)) throw new Error('Fuse: delay must be >= 0');
  }

  /** Start (or restart) the countdown. */
  arm(): void {
    this.t = 0;
    this.fired = false;
    this.armed = true;
  }

  /** Advance; fires exactly once at `delay` (delay 0 → first update). */
  update(dt: number): void {
    if (!this.armed || this.fired) return;
    this.t += dt;
    if (this.t >= this.delay) {
      this.t = this.delay;
      this.fired = true;
    }
  }

  /** Early detonation (e.g. impact). No-op when not armed or already fired. */
  detonate(): void {
    if (!this.armed || this.fired) return;
    this.t = this.delay;
    this.fired = true;
  }

  /** Has the fuse fired (since the last arm)? */
  get isFired(): boolean {
    return this.fired;
  }

  /** 0..1 elapsed fraction (progress for flash/SFX); 0 when unarmed. */
  get progress(): number {
    if (!this.armed) return 0;
    if (this.delay <= 0) return 1;
    return Math.min(1, this.t / this.delay);
  }

  /** Seconds remaining (0 after firing). */
  get remaining(): number {
    return Math.max(0, this.delay - this.t);
  }
}
