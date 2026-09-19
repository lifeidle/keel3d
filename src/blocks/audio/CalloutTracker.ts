/**
 * CalloutTracker — per-key radio callout pacing + stats (R70). Pure.
 *
 * Gap: content hand-rolls the pattern "forward a per-key min-gap to the
 * voice bank, then count attempts / successes / last announced key" per
 * radio group (yexi squad radio: wave/kill/streak/…). The tracker owns
 * the stats and the gap forwarding; content supplies the definition
 * (key/gain/gapMs) and the voice bank (duck-typed).
 *
 * Semantics (deliberate): `last` is the last key ATTEMPTED (not the last
 * that played) — a gap-blocked callout still tells content WHAT was
 * attempted. `attempts` counts every call; `ok` counts plays that the
 * bank actually started.
 */
export interface CalloutDef {
  /**
   * Content-level identifier (e.g. the radio GROUP name). Tracked in `last`
   * and per-id counts. Falls back to `key` when omitted.
   */
  id?: string;
  /** Voice-bank key (what is actually played / gap-gated). */
  key: string;
  /** Play gain (0..1-ish). */
  gain: number;
  /** Minimum interval between plays of this key (ms) — forwarded to the bank. */
  gapMs: number;
}

/**
 * Voice bank surface (SampleBank satisfies this; tests inject a fake).
 */
export interface CalloutBank {
  /** Set the minimum interval for a key (idempotent — safe every call). */
  setMinGap(key: string, ms: number): void;
  /** Play the voice; true when it actually started. */
  playVoice(key: string, gain: number): boolean;
}

export interface CalloutCount {
  attempts: number;
  ok: number;
}

export class CalloutTracker {
  private counts = new Map<string, CalloutCount>();
  private lastKey: string | null = null;
  private atts = 0;
  private oks = 0;

  constructor(private bank: CalloutBank) {}

  /**
   * Attempt a callout: forward the gap, count it, play it.
   * Returns true when the voice actually started (gap open + buffer ready).
   */
  call(def: CalloutDef): boolean {
    this.bank.setMinGap(def.key, def.gapMs);
    const id = def.id ?? def.key;
    const c = this.counts.get(id) ?? { attempts: 0, ok: 0 };
    c.attempts += 1;
    this.counts.set(id, c);
    this.lastKey = id;
    this.atts += 1;
    const ok = this.bank.playVoice(def.key, def.gain);
    if (ok) {
      c.ok += 1;
      this.oks += 1;
    }
    return ok;
  }

  /** Last key attempted (null before the first call). */
  get last(): string | null {
    return this.lastKey;
  }

  /** Per-key counts (zeros when the key was never called). */
  count(key: string): CalloutCount {
    return this.counts.get(key) ?? { attempts: 0, ok: 0 };
  }

  /** Total attempts across all keys. */
  get totalAttempts(): number {
    return this.atts;
  }

  /** Total successful plays across all keys. */
  get totalOk(): number {
    return this.oks;
  }
}
