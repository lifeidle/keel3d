/**
 * ProgressGate — hold-to-progress action (R96).
 *
 * Gap: the "hold a key → progress 0..1 → fires on completion, cancels on
 * release" pattern (vehicle repair, prying, carrying, channeling) is
 * re-implemented ad hoc in every content: the progress variable, the
 * cancel condition and the completion EDGE each live in content code.
 * One block owns the progress + cancel + completion-edge semantics;
 * content just feeds `update(dt, held)` and acts on the returned edge.
 */
export class ProgressGate {
  private progress = 0;
  private active = false;
  private duration: number;

  constructor(duration: number) {
    if (!Number.isFinite(duration) || !(duration > 0)) {
      throw new Error('ProgressGate: duration must be finite and > 0');
    }
    this.duration = duration;
  }

  /** True while progress is between 0 and 1 (excluded). */
  get inProgress(): boolean {
    return this.active && this.progress < 1;
  }

  /** Current progress 0..1 (0 when idle/cancelled). */
  get ratio(): number {
    return this.active ? Math.min(1, this.progress) : 0;
  }

  /**
   * Feed one frame. `held` = the action input is down.
   * - release (held false) → progress RESET (cancel);
   * - progress reaches 1 → returns true ONCE (completion edge), then the
   *   gate goes idle until `cancel()`/`reset()`.
   * Returns the completion edge this call.
   */
  update(dt: number, held: boolean): boolean {
    if (!Number.isFinite(dt) || dt < 0) {
      throw new Error('ProgressGate.update: dt must be finite and >= 0');
    }
    if (!held) {
      this.active = false;
      this.progress = 0;
      return false;
    }
    if (!this.active) this.active = true;
    if (this.progress >= 1) return false; // already fired — no re-fire
    this.progress += dt / this.duration;
    if (this.progress >= 1) {
      this.progress = 1;
      this.active = false;
      return true;
    }
    return false;
  }

  /** Cancel mid-progress (e.g. the target left range). */
  cancel(): void {
    this.active = false;
    this.progress = 0;
  }
}
