/**
 * XpProgress — level curve. Pure logic.
 */
export interface XpOpts {
  /** XP required for level n (1-based next level). Default n^1.4 * 50. */
  curve?: (level: number) => number;
  startLevel?: number;
}

export class XpProgress {
  private _xp = 0;
  private _level: number;
  private curve: (level: number) => number;
  onLevelUp?: (level: number) => void;

  constructor(opts: XpOpts = {}) {
    this._level = Math.max(1, opts.startLevel ?? 1);
    this.curve = opts.curve ?? ((n) => Math.floor(Math.pow(n, 1.4) * 50));
  }

  get xp(): number {
    return this._xp;
  }

  get level(): number {
    return this._level;
  }

  /** XP still needed for next level. */
  get toNext(): number {
    return Math.max(0, this.curve(this._level) - this._xp);
  }

  get progress(): number {
    const need = this.curve(this._level);
    return need <= 0 ? 1 : Math.min(1, this._xp / need);
  }

  addXp(n: number): number {
    if (n <= 0) return this._level;
    this._xp += n;
    let ups = 0;
    while (this._xp >= this.curve(this._level)) {
      this._xp -= this.curve(this._level);
      this._level++;
      ups++;
      this.onLevelUp?.(this._level);
    }
    return ups;
  }

  reset(): void {
    this._xp = 0;
    this._level = 1;
  }
}
