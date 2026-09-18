/**
 * AmmoPool — generic magazine / reserve / reload state machine (R55).
 *
 * Gap: every shooting entity (yexi's allies) needs mag consumption,
 * auto-reload when empty, reserve-limited reloading, and resupply with
 * capping. Content currently hand-rolls this (or skips it entirely —
 * infinite ammo). Pure state: headless-testable.
 */
export class AmmoPool {
  private mag: number;
  private reserve: number;
  private reloadT = 0;
  private reloading = false;

  constructor(
    private magSize: number,
    reserve: number,
    private reloadTime: number,
  ) {
    if (!(this.magSize > 0) || !(this.reloadTime > 0)) {
      throw new Error('AmmoPool: magSize and reloadTime must be > 0');
    }
    this.mag = this.magSize;
    this.reserve = Math.max(0, Math.floor(reserve));
  }

  /**
   * Consume one round. Returns false (no shot) when the mag is empty or
   * a reload is in progress; an empty mag with reserve left starts the
   * reload automatically.
   */
  fire(): boolean {
    if (this.reloading) return false;
    if (this.mag <= 0) {
      if (this.reserve > 0) {
        this.reloading = true;
        this.reloadT = 0;
      }
      return false;
    }
    this.mag -= 1;
    if (this.mag === 0 && this.reserve > 0) {
      this.reloading = true;
      this.reloadT = 0;
    }
    return true;
  }

  /** Advance one frame — completes the reload, moving rounds in. */
  update(dt: number): void {
    if (!this.reloading) return;
    this.reloadT += dt;
    if (this.reloadT >= this.reloadTime) {
      const take = Math.min(this.magSize, this.reserve);
      this.mag = take;
      this.reserve -= take;
      this.reloading = false;
      this.reloadT = 0;
    }
  }

  /**
   * Add reserve ammo (resupply). Capped at `cap`; returns how much was
   * actually added (0 when already at the cap).
   */
  addReserve(n: number, cap = Number.MAX_SAFE_INTEGER): number {
    const add = Math.max(0, Math.min(Math.floor(n), Math.max(0, cap - this.reserve)));
    this.reserve += add;
    return add;
  }

  get magLeft(): number {
    return this.mag;
  }
  get reserveLeft(): number {
    return this.reserve;
  }
  get isReloading(): boolean {
    return this.reloading;
  }
  /** Out of everything (dry) — the shooter must stop until resupplied. */
  get isDry(): boolean {
    return this.mag === 0 && this.reserve === 0 && !this.reloading;
  }
}
