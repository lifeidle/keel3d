/**
 * WindowBar — remaining-time bar for a rolling window (R72).
 *
 * Gap: "show how long a combo/streak window has left" — content needs a
 * bar that refills on each event and drains to zero at window expiry.
 * The clock math is pure (monotonic-seconds input, caller advances it);
 * the optional DOM element's `width` is driven as a percentage string.
 * Headless-safe: no element → logic only.
 */
export interface WindowBarOpts {
  /** Window length (seconds, clock units). */
  window: number;
  /** Fill element whose `style.width` is driven ("0%".."100%"). Optional. */
  el?: HTMLElement | null;
}

export class WindowBar {
  private last: number;
  private readonly opts: WindowBarOpts;

  constructor(opts: WindowBarOpts) {
    if (!Number.isFinite(opts.window) || opts.window <= 0) {
      throw new Error('WindowBar: window must be finite and > 0');
    }
    this.opts = opts;
    this.last = -Infinity; // idle
  }

  /** (Re)start the window at clock `t` (an event was registered). */
  mark(t: number): void {
    this.last = t;
  }

  /**
   * Remaining fraction at clock `t` (1 just after a mark, 0 when idle or
   * expired). Monotone between marks.
   */
  fractionAt(t: number): number {
    const left = this.last + this.opts.window - t;
    if (left <= 0) return 0;
    return Math.min(1, left / this.opts.window);
  }

  /**
   * Drive the bar at clock `t`. Returns the remaining fraction; the DOM
   * width follows it (rounded percentage — no style churn at idle).
   */
  update(t: number): number {
    const f = this.fractionAt(t);
    if (this.opts.el) this.opts.el.style.width = `${Math.round(f * 100)}%`;
    return f;
  }
}
