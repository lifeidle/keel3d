/**
 * Timers — cooldown / delayed callbacks. Opt-in helper, not a System.
 */
export class Timers {
  private items: Array<{ t: number; fn: () => void; repeat: number | null; interval: number }> = [];

  /** Run fn after delay seconds. */
  after(delay: number, fn: () => void): void {
    this.items.push({ t: delay, fn, repeat: null, interval: delay });
  }

  /** Run fn every interval seconds (first fire after interval). */
  every(interval: number, fn: () => void): void {
    this.items.push({ t: interval, fn, repeat: interval, interval });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t -= dt;
      if (it.t > 0) continue;
      it.fn();
      if (it.repeat == null) this.items.splice(i, 1);
      else it.t += it.repeat;
    }
  }

  clear(): void {
    this.items.length = 0;
  }

  get size(): number {
    return this.items.length;
  }
}
