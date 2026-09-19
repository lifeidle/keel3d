/**
 * Magazine — pure per-slot ammo state machine. Opt-in; no engine deps.
 * Tracks rounds / reserve / reload and the timed refill.
 */
export class Magazine {
  rounds: number;
  reserve: number;
  reloading = false;
  private timer = 0;
  private total = 0;

  constructor(
    public magSize: number,
    rounds: number,
    reserve: number,
  ) {
    this.rounds = rounds;
    this.reserve = reserve;
  }

  get empty(): boolean {
    return this.rounds <= 0;
  }

  canFire(): boolean {
    return !this.reloading && this.rounds > 0;
  }

  consume(): void {
    if (this.rounds > 0) this.rounds--;
  }

  /** Resupply point: top the reserve back to the initial allocation. */
  refillReserve(initial: number): void {
    this.reserve = Math.max(this.reserve, initial);
  }

  /** Set the reserve directly (floored at 0). Returns the new value. */
  setReserve(n: number): number {
    this.reserve = Math.max(0, n);
    return this.reserve;
  }

  /** Begin a reload if there's room and spare ammo. Takes `reloadTime` seconds. */
  startReload(reloadTime: number): void {
    if (this.reloading || this.rounds >= this.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this.timer = reloadTime;
    this.total = reloadTime;
  }

  /** Abort an in-progress reload (weapon switch). */
  cancelReload(): void {
    this.reloading = false;
    this.timer = 0;
    this.total = 0;
  }

  /** Seconds left in the reload (0 when not reloading). */
  get reloadRemaining(): number {
    return this.reloading ? Math.max(0, this.timer) : 0;
  }

  /**
   * Reload progress 0..1 (0 just after start → 1 at completion; 0 when not
   * reloading). Consumers: reload progress bars / "X.Xs" readouts.
   */
  get reloadProgress(): number {
    if (!this.reloading || this.total <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - this.timer / this.total));
  }

  /** Advance the reload timer; completes the refill when it reaches zero. */
  tick(dt: number): void {
    if (!this.reloading) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      const need = this.magSize - this.rounds;
      const take = Math.min(need, this.reserve);
      this.rounds += take;
      this.reserve -= take;
      this.reloading = false;
    }
  }
}
