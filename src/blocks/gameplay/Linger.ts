/**
 * Linger — generic "linger then fade" state machine (R56).
 *
 * Gap: content hand-rolls decay timers with ramp tails (yexi's flare
 * landing light: lightT -= ft, intensity = peak · min(1, lightT/1.5)).
 * This block owns the pattern: start(), update(dt), alpha 1 → 0 with a
 * linear ramp over the final `ramp` seconds. Reusable for corpses,
 * lights, effects — anything that should persist and then ease out.
 */
export class Linger {
  private t = 0;
  private active = false;
  private ramp: number;

  constructor(
    private duration: number,
    ramp = 1.5,
  ) {
    if (!(this.duration > 0)) throw new Error('Linger: duration must be > 0');
    this.ramp = Math.min(Math.max(0, ramp), this.duration);
  }

  /** (Re)start the linger from full strength. */
  start(): void {
    this.t = 0;
    this.active = true;
  }

  /** Advance one step; completes at `duration`. */
  update(dt: number): void {
    if (!this.active) return;
    this.t += dt;
    if (this.t >= this.duration) {
      this.t = this.duration;
      this.active = false;
    }
  }

  get isActive(): boolean {
    return this.active;
  }
  /** True once the linger has run to completion. */
  get done(): boolean {
    return this.t >= this.duration;
  }

  /**
   * 0 when idle; 1 while lingering, easing linearly to 0 over the final
   * `ramp` seconds (full window if duration < ramp).
   */
  get alpha(): number {
    if (this.t <= 0) return this.active ? 1 : 0;
    const window = this.duration - this.ramp;
    const k = this.t <= window ? 1 : (this.duration - this.t) / this.ramp;
    return Math.max(0, Math.min(1, k));
  }
}
