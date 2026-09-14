/**
 * LootTable — weighted drops. Pure logic; inject rng for tests.
 */
export interface LootEntry {
  id: string;
  weight: number;
  qty?: number | [number, number];
}

export interface ItemStack {
  id: string;
  qty: number;
}

export interface LootTableOpts {
  /** [0,1) uniform; default Math.random */
  rng?: () => number;
  /** Default rolls per roll() call. Default 1. */
  rolls?: number;
}

export class LootTable {
  private entries: LootEntry[];
  private total: number;
  private rng: () => number;
  private defaultRolls: number;

  constructor(entries: LootEntry[], opts: LootTableOpts = {}) {
    this.entries = entries.filter((e) => e.weight > 0);
    this.total = this.entries.reduce((s, e) => s + e.weight, 0);
    this.rng = opts.rng ?? Math.random;
    this.defaultRolls = Math.max(1, opts.rolls ?? 1);
  }

  get size(): number {
    return this.entries.length;
  }

  rollOne(): ItemStack | null {
    if (this.total <= 0) return null;
    let r = this.rng() * this.total;
    for (const e of this.entries) {
      r -= e.weight;
      if (r <= 0) {
        const q = e.qty;
        let qty = 1;
        if (typeof q === 'number') qty = Math.max(1, Math.floor(q));
        else if (Array.isArray(q)) {
          const lo = Math.floor(q[0]);
          const hi = Math.floor(q[1]);
          qty = lo + Math.floor(this.rng() * (hi - lo + 1));
        }
        return { id: e.id, qty };
      }
    }
    const last = this.entries[this.entries.length - 1];
    return last ? { id: last.id, qty: 1 } : null;
  }

  roll(times = this.defaultRolls): ItemStack[] {
    const out: ItemStack[] = [];
    for (let i = 0; i < times; i++) {
      const s = this.rollOne();
      if (s) out.push(s);
    }
    return out;
  }
}
