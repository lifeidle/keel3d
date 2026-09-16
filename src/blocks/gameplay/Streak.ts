/**
 * Streak — rolling-window event count with threshold callbacks.
 *
 * The general "kill streak / combo" mechanism: events inside a time
 * window accumulate; a gap longer than the window resets the count.
 * Thresholds fire exactly once each time the count lands on them.
 * Pure time-parametered (caller feeds a monotonically increasing clock),
 * headless-testable.
 */

export interface StreakOpts {
  /** Window seconds: a gap longer than this resets the count. */
  window: number;
  /** Counts at which `onStreak` fires (each at most once per run). */
  thresholds?: number[];
  onStreak?: (n: number) => void;
}

export class Streak {
  private opts: StreakOpts;
  private times: number[] = [];
  private fired = new Set<number>();
  count = 0;
  best = 0;

  constructor(opts: StreakOpts) {
    this.opts = opts;
  }

  /** Register an event at clock time `t` (monotonic seconds). */
  hit(t: number): number {
    this.times.push(t);
    this.prune(t);
    this.count = this.times.length;
    if (this.count > this.best) this.best = this.count;
    for (const th of this.opts.thresholds ?? []) {
      if (this.count === th && !this.fired.has(th)) {
        this.fired.add(th);
        this.opts.onStreak?.(th);
      }
    }
    return this.count;
  }

  /** Advance the clock: expire old events; a long gap resets the run. */
  update(t: number): void {
    if (this.times.length && t - this.times[this.times.length - 1] > this.opts.window) {
      this.times = [];
      this.count = 0;
      this.fired.clear(); // a new run may re-fire thresholds
    }
    this.prune(t);
    this.count = this.times.length;
  }

  /** Start over (game over / new run). */
  reset(): void {
    this.times = [];
    this.count = 0;
    this.fired.clear();
  }

  private prune(t: number): void {
    while (this.times.length && t - this.times[0] > this.opts.window) {
      this.times.shift();
    }
  }
}
