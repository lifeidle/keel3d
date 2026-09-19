/**
 * ThresholdGate — edge-triggered threshold with hysteresis re-arm (R64).
 * Pure, headless.
 *
 * Gap: "fire exactly once when a value crosses below X, and only re-arm
 * after it recovers above X + margin" is a hand-rolled pattern per
 * content (low-HP warning, low-ammo warning). LossTension is the decaying
 * sink; this is the edge detector that feeds it — without the latch a
 * per-frame `hp < 30` check re-fires every frame.
 */
export class ThresholdGate {
  private threshold: number;
  private margin: number;
  private armed = true;

  constructor(threshold: number, margin = 0) {
    if (!(threshold >= 0) || !Number.isFinite(threshold)) {
      throw new Error('ThresholdGate: threshold must be a finite value >= 0');
    }
    if (!(margin >= 0) || !Number.isFinite(margin)) {
      throw new Error('ThresholdGate: margin must be a finite value >= 0');
    }
    this.threshold = threshold;
    this.margin = margin;
  }

  /**
   * Feed a sample.
   * - armed + v < threshold → latch and return true (the edge).
   * - latched: stays latched until v >= threshold + margin (re-arm).
   * Returns true only on the firing edge, never while latched.
   */
  sample(v: number): boolean {
    if (this.armed) {
      if (v < this.threshold) {
        this.armed = false;
        return true;
      }
      return false;
    }
    if (v >= this.threshold + this.margin) {
      this.armed = true;
    }
    return false;
  }

  /** True while latched (has fired, not yet re-armed). */
  get latched(): boolean {
    return !this.armed;
  }

  /** Re-arm immediately (reset / new round). */
  reset(): void {
    this.armed = true;
  }
}
