/**
 * Cooldown — simple ability / weapon timer. Opt-in.
 */
export class Cooldown {
  private t = 0;
  readonly duration: number;

  constructor(duration: number) {
    this.duration = Math.max(0, duration);
  }

  get ready(): boolean {
    return this.t <= 0;
  }

  /** 0..1 remaining */
  get ratio(): number {
    if (this.duration <= 0) return 0;
    return Math.min(1, this.t / this.duration);
  }

  /** Returns true if the ability fired. */
  tryFire(): boolean {
    if (!this.ready) return false;
    this.t = this.duration;
    return true;
  }

  update(dt: number): void {
    if (this.t > 0) this.t = Math.max(0, this.t - dt);
  }

  reset(): void {
    this.t = 0;
  }
}
