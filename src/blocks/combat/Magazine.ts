/**
 * Magazine — pure per-slot ammo state machine. Opt-in; no engine deps.
 * Tracks rounds / reserve / reload and the timed refill.
 */
export class Magazine {
  rounds: number;
  reserve: number;
  reloading = false;
  private timer = 0;

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

  /** Begin a reload if there's room and spare ammo. Takes `reloadTime` seconds. */
  startReload(reloadTime: number): void {
    if (this.reloading || this.rounds >= this.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this.timer = reloadTime;
  }

  /** Abort an in-progress reload (weapon switch). */
  cancelReload(): void {
    this.reloading = false;
    this.timer = 0;
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
