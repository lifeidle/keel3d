/**
 * Ambience — randomized-interval ambient one-shots (R62). Pure
 * scheduling, headless-testable (inject `random` for determinism).
 *
 * Gap: yexi had zero ambient layers; the generic "play a clip every
 * X–Y seconds at random, gated by a condition (e.g. night)" pattern was
 * missing as a block. Content supplies the play callback and the gate;
 * the block owns the timer, the re-pick after each play, and pausing
 * while the gate is closed (the timer does not run down).
 */
export interface AmbienceOpts {
  /** Minimum seconds between plays. Must be > 0. */
  minInterval: number;
  /** Maximum seconds between plays. Must be >= minInterval. */
  maxInterval: number;
  /** Gate — while false the timer pauses and no plays happen. */
  enabled: () => boolean;
  /** Called when a play fires (content picks the clip). */
  onPlay?: () => void;
  /** Random source (inject for tests). Default Math.random. */
  random?: () => number;
}

export class Ambience {
  private nextIn: number;
  private plays = 0;
  private rand: () => number;

  constructor(private opts: AmbienceOpts) {
    if (!(opts.minInterval > 0)) {
      throw new Error('Ambience: minInterval must be > 0');
    }
    if (opts.maxInterval < opts.minInterval) {
      throw new Error('Ambience: maxInterval must be >= minInterval');
    }
    this.rand = opts.random ?? Math.random;
    this.nextIn = this.pick();
  }

  /** Uniform interval in [min, max). r=0 → min, r=1 → max. */
  private pick(): number {
    return this.opts.minInterval +
      (this.opts.maxInterval - this.opts.minInterval) * this.rand();
  }

  /**
   * Advance. While the gate is closed the timer pauses (no run-down).
   * On expiry: onPlay + re-pick (a play consumes its interval).
   */
  update(dt: number): void {
    if (!this.opts.enabled()) return;
    this.nextIn -= dt;
    if (this.nextIn <= 0) {
      this.plays += 1;
      this.opts.onPlay?.();
      this.nextIn = this.pick();
    }
  }

  /** Plays fired so far (data-level — independent of audio success). */
  get playCount(): number {
    return this.plays;
  }

  /** Reset the counter and re-arm with a fresh random delay. */
  reset(): void {
    this.plays = 0;
    this.nextIn = this.pick();
  }
}
