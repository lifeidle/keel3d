/**
 * SaveSlot — versioned JSON blob persistence.
 *
 * Opt-in; no I/O until you call save/load. The storage backend is injected
 * (a `SaveStore`); by default it uses `localStorage` when available and
 * degrades to a no-op otherwise (SSR / headless). Passing an in-memory
 * store makes the slot fully testable without a browser.
 */

export interface SaveStore {
  load(key: string): string | null;
  save(key: string, data: string): void;
  remove?(key: string): void;
}

/** In-memory store — headless tests and SSR fallbacks. */
export function memoryStore(): SaveStore {
  const map = new Map<string, string>();
  return {
    load: (key) => (map.has(key) ? map.get(key)! : null),
    save: (key, data) => {
      map.set(key, data);
    },
    remove: (key) => {
      map.delete(key);
    },
  };
}

/** localStorage adapter (browser only). */
function localStore(): SaveStore | null {
  if (typeof localStorage === 'undefined') return null;
  return {
    load: (key) => localStorage.getItem(key),
    save: (key, data) => {
      localStorage.setItem(key, data);
    },
    remove: (key) => {
      localStorage.removeItem(key);
    },
  };
}

export interface SaveSlotOpts {
  /** Storage key. */
  key: string;
  /** Bump when schema changes; load() runs migrate if provided. */
  version?: number;
  migrate?: (data: Record<string, unknown>, fromVersion: number) => Record<string, unknown>;
  /** Storage backend. Defaults to localStorage (or no-op when unavailable). */
  store?: SaveStore;
}

export class SaveSlot {
  readonly key: string;
  private version: number;
  private migrate?: SaveSlotOpts['migrate'];
  private store: SaveStore | null;

  constructor(opts: SaveSlotOpts) {
    this.key = opts.key;
    this.version = opts.version ?? 1;
    this.migrate = opts.migrate;
    this.store = opts.store ?? localStore();
  }

  exists(): boolean {
    return this.store != null && this.store.load(this.key) != null;
  }

  save(payload: Record<string, unknown>): boolean {
    if (!this.store) return false;
    try {
      this.store.save(
        this.key,
        JSON.stringify({ v: this.version, t: Date.now(), d: payload }),
      );
      return true;
    } catch {
      return false;
    }
  }

  load<T extends Record<string, unknown> = Record<string, unknown>>(): T | null {
    if (!this.store) return null;
    try {
      const raw = this.store.load(this.key);
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
    if (this.store && this.store.remove) this.store.remove(this.key);
  }
}

/** Best-score helper for racing / arena recipes. */
export class BestScoreSlot {
  private slot: SaveSlot;

  constructor(key: string, store?: SaveStore) {
    this.slot = new SaveSlot({ key, version: 1, store });
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
