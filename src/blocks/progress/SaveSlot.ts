/**
 * SaveSlot — versioned JSON blob in localStorage (browser only).
 * Opt-in; no I/O until you call save/load.
 */

export interface SaveSlotOpts {
  /** localStorage key. */
  key: string;
  /** Bump when schema changes; load() runs migrate if provided. */
  version?: number;
  migrate?: (data: Record<string, unknown>, fromVersion: number) => Record<string, unknown>;
}

const hasLs = () => typeof localStorage !== 'undefined';

export class SaveSlot {
  readonly key: string;
  private version: number;
  private migrate?: SaveSlotOpts['migrate'];

  constructor(opts: SaveSlotOpts) {
    this.key = opts.key;
    this.version = opts.version ?? 1;
    this.migrate = opts.migrate;
  }

  exists(): boolean {
    return hasLs() && localStorage.getItem(this.key) != null;
  }

  save(payload: Record<string, unknown>): boolean {
    if (!hasLs()) return false;
    try {
      localStorage.setItem(
        this.key,
        JSON.stringify({ v: this.version, t: Date.now(), d: payload }),
      );
      return true;
    } catch {
      return false;
    }
  }

  load<T extends Record<string, unknown> = Record<string, unknown>>(): T | null {
    if (!hasLs()) return null;
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { v?: number; d?: T };
      let data = (parsed.d ?? {}) as Record<string, unknown>;
      const from = parsed.v ?? 1;
      if (from !== this.version && this.migrate) data = this.migrate(data, from);
      return data as T;
    } catch {
      return null;
    }
  }

  clear(): void {
    if (!hasLs()) return;
    localStorage.removeItem(this.key);
  }
}

/** Best-score helper for racing / arena recipes. */
export class BestScoreSlot {
  private slot: SaveSlot;

  constructor(key: string) {
    this.slot = new SaveSlot({ key, version: 1 });
  }

  /** Lower is better when `lowerIsBetter` (lap time). */
  read(field = 'best'): number | null {
    const d = this.slot.load();
    if (!d) return null;
    const v = d[field];
    return typeof v === 'number' ? v : null;
  }

  /** Returns true if this score improved the record. */
  submit(score: number, field = 'best', lowerIsBetter = false): boolean {
    const prev = this.read(field);
    if (prev == null) {
      this.slot.save({ [field]: score });
      return true;
    }
    const better = lowerIsBetter ? score < prev : score > prev;
    if (better) this.slot.save({ [field]: score });
    return better;
  }

  clear(): void {
    this.slot.clear();
  }
}
