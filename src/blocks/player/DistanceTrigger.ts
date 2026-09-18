/**
 * DistanceTrigger — fires a counter every `stride` units of accumulated
 * movement distance (footstep cadence, dash ticks, tire marks…).
 *
 * Pure and headless-testable: no clock, no DOM. Content feeds movement
 * distance each frame (or in bulk via debug hooks) and plays an effect per
 * crossed stride.
 */
export class DistanceTrigger {
  private accum = 0;
  private stride: number;

  constructor(stride: number) {
    if (!Number.isFinite(stride) || stride <= 0) {
      throw new Error('DistanceTrigger: stride must be finite and > 0');
    }
    this.stride = stride;
  }

  /**
   * Feed movement distance (≥0). Returns how many full strides were
   * crossed (0..n); the sub-stride remainder carries over.
   */
  add(dist: number): number {
    if (!Number.isFinite(dist) || dist <= 0) return 0;
    this.accum += dist;
    const n = Math.floor(this.accum / this.stride);
    if (n > 0) this.accum -= n * this.stride;
    return n;
  }

  /** Fraction of the current stride (0..1) — cadence FX / phase sync. */
  get phase(): number {
    return this.stride > 0 ? this.accum / this.stride : 0;
  }

  /** Drop the sub-stride remainder. */
  reset(): void {
    this.accum = 0;
  }

  /** Change cadence (stride must stay finite and > 0). */
  setStride(s: number): void {
    if (!Number.isFinite(s) || s <= 0) {
      throw new Error('DistanceTrigger: stride must be finite and > 0');
    }
    this.stride = s;
  }
}
