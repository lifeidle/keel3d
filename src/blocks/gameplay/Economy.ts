/**
 * Economy — single resource pool (gold). Opt-in.
 */
export interface EconomyOpts {
  start?: number;
  onChange?: (balance: number, delta: number) => void;
}

export class Economy {
  private amount: number;
  private onChange?: EconomyOpts['onChange'];

  constructor(opts: EconomyOpts = {}) {
    this.amount = Math.max(0, opts.start ?? 0);
    this.onChange = opts.onChange;
  }

  get balance(): number {
    return this.amount;
  }

  add(n: number): number {
    if (n <= 0) return this.amount;
    this.amount += n;
    this.onChange?.(this.amount, n);
    return this.amount;
  }

  canAfford(cost: number): boolean {
    return this.amount >= cost;
  }

  /** Returns false if insufficient funds (no change). */
  spend(cost: number): boolean {
    if (cost <= 0) return true;
    if (this.amount < cost) return false;
    this.amount -= cost;
    this.onChange?.(this.amount, -cost);
    return true;
  }
}
