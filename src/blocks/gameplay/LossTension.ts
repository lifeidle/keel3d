/**
 * LossTension — decaying loss tension (R61). Pure, headless-testable.
 *
 * Gap: content tracks "how bad things got" with ad-hoc time windows
 * (yexi's 0.5s recent-event window is a hard cutoff — tension either
 * exists or doesn't). A decaying meter is the generic "things went bad
 * and it takes time to recover" signal that music mood, camera and UI
 * all want: note a loss (max semantics — the worst recent loss wins),
 * then exponential decay toward a floor (half-life based).
 */
export class LossTension {
  private level = 0;

  constructor(
    /** Seconds for the level to halve toward the floor. */
    private halfLife: number = 6,
    /** Decay floor (severity that persists, e.g. a broken squad). */
    private floor = 0,
  ) {
    if (!(this.halfLife > 0)) throw new Error('LossTension: halfLife must be > 0');
    if (this.floor < 0 || this.floor > 1) {
      throw new Error('LossTension: floor must be within 0..1');
    }
  }

  /** Register a loss (0..1 severity). Max semantics — never lowers. */
  note(severity = 1): void {
    const s = Math.min(1, Math.max(0, severity));
    if (s > this.level) this.level = s;
  }

  /** Exponential decay toward the floor: half-life based, dt in seconds. */
  update(dt: number): void {
    if (this.level <= this.floor) return;
    this.level = this.floor + (this.level - this.floor) * Math.pow(0.5, dt / this.halfLife);
  }

  /** Current tension (0..1). */
  get value(): number {
    return this.level;
  }

  /** Reset to the floor (round restart). */
  reset(): void {
    this.level = this.floor;
  }
}
