/**
 * StepSequencer — table-driven short musical phrase (R65). Pure, headless.
 *
 * Gap: "play steps from a table at their `at` offsets, advancing a cursor
 * as time passes, one run at a time, counting completed runs" — yexi
 * hand-rolled this cursor arithmetic per frame for its win jingle (4-step
 * phrase). The sequencer owns the cursor, the multi-step-per-frame catch-up
 * and completion counting; content supplies the step table and the fire
 * callback (clip name/gain/rate or anything else).
 */
export interface SeqStep {
  /** Offset from the run start (seconds). Must be >= 0 and non-decreasing. */
  at: number;
  /** Clip / event name passed to the fire callback. */
  name: string;
  gain?: number;
  rate?: number;
}

export class StepSequencer {
  private i: number;
  private t = 0;
  private runs = 0;

  constructor(
    private steps: readonly SeqStep[],
    /** Called per step as it fires (content plays the clip). */
    private onStep?: (s: SeqStep) => void,
  ) {
    if (!steps.length) throw new Error('StepSequencer: steps must be non-empty');
    let prev = -Infinity;
    for (const s of steps) {
      if (!(s.at >= 0) || !Number.isFinite(s.at)) {
        throw new Error('StepSequencer: step `at` must be finite and >= 0');
      }
      if (s.at < prev) {
        throw new Error('StepSequencer: steps must be non-decreasing in `at`');
      }
      prev = s.at;
    }
    this.i = steps.length; // idle
  }

  /** Start (or restart) a run at cursor 0. */
  start(): void {
    this.i = 0;
    this.t = 0;
  }

  /** A run in progress (cursor before the last step). */
  get playing(): boolean {
    return this.i < this.steps.length;
  }

  /** Completed runs (a run completes on the frame its last step fires). */
  get runsCompleted(): number {
    return this.runs;
  }

  /**
   * Advance by dt (status-independent, like the hand-rolled version).
   * Fires every step whose offset has been reached — a large dt catches up
   * through several steps in one frame, in order. Returns the steps fired
   * this frame (idle → []).
   */
  update(dt: number): SeqStep[] {
    if (!this.playing) return [];
    this.t += dt;
    const fired: SeqStep[] = [];
    while (this.i < this.steps.length && this.steps[this.i].at <= this.t) {
      const s = this.steps[this.i];
      this.onStep?.(s);
      fired.push(s);
      this.i += 1;
    }
    if (this.i >= this.steps.length) this.runs += 1;
    return fired;
  }
}
