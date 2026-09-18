/**
 * CooldownGate — per-key minimum-interval pacing for one-shots / voice
 * callouts (so a kill streak doesn't machine-gun the radio).
 *
 * Pure and headless: the clock is injected (Date.now default), so tests can
 * drive time deterministically. SampleBank uses one internally for its
 * per-key minGap; content can compose its own.
 */
export class CooldownGate {
  private last = new Map<string, number>();
  constructor(private clock: () => number = () => Date.now()) {}

  /**
   * Passes (and records `now`) when the key has been quiet for at least
   * `minGapMs`. A key with no recorded pass always passes.
   */
  tryPass(key: string, minGapMs: number): boolean {
    const now = this.clock();
    const lastAt = this.last.get(key);
    if (lastAt !== undefined && now - lastAt < minGapMs) return false;
    this.last.set(key, now);
    return true;
  }

  /** Reset one key (or every key when omitted). */
  clear(key?: string): void {
    if (key === undefined) this.last.clear();
    else this.last.delete(key);
  }

  /** Whether a key currently has a recorded pass time. */
  has(key: string): boolean {
    return this.last.has(key);
  }
}
