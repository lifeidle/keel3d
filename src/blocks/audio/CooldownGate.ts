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
   * `minGap` (clock units). A key with no recorded pass always passes.
   */
  tryPass(key: string, minGap: number): boolean {
    const now = this.clock();
    const lastAt = this.last.get(key);
    if (lastAt !== undefined && now - lastAt < minGap) return false;
    this.last.set(key, now);
    return true;
  }

  /**
   * The last recorded pass time for `key` (clock units), or null.
   * R66: observability + the bypass-and-restore test pattern
   * (clear → act → setLast to undo a failed bypass).
   */
  lastAt(key: string): number | null {
    const t = this.last.get(key);
    return t === undefined ? null : t;
  }

  /**
   * R66: set/restore a key's last-pass time (clock units). Enables
   * "bypass the gate, and restore the previous state if the action
   * failed" without content keeping shadow timers.
   */
  setLast(key: string, at: number): void {
    this.last.set(key, at);
  }

  /**
   * R66: time left until `key` would pass again (clock units; 0 when
   * free or unknown). For HUDs and probes.
   */
  remaining(key: string, minGap: number): number {
    const t = this.last.get(key);
    if (t === undefined) return 0;
    return Math.max(0, minGap - (this.clock() - t));
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
