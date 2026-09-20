/**
 * HitConfirm — hit/kill event classification + flash timing (R86).
 *
 * Gap: FPS-style hit markers distinguish "hit" (neutral) from "kill"
 * (emphasized) and count each — a pure event-classification pattern that
 * content drives from its damage paths and reads for stats. Timing reuses
 * Linger (linger-then-fade); the block adds KIND (latest event, cleared
 * once the flash fades) and COUNTERS.
 */
import { Linger } from '../gameplay/Linger';

export type HitKind = 'hit' | 'kill';

export class HitConfirm {
  private flash: Linger;
  private kind: HitKind | null = null;
  // field/getter name clash guard (same pattern as CalloutTracker R70)
  private hitCount = 0;
  private killCount = 0;
  private duration: number;

  /** `duration` = flash window in seconds (default 0.14, yexi's marker). */
  constructor(duration = 0.14) {
    if (!(duration > 0)) throw new Error('HitConfirm: duration must be > 0');
    this.duration = duration;
    this.flash = new Linger(duration, duration);
  }

  /**
   * Register an event: updates the counter, sets the latest kind and
   * (re)starts the flash. A kill registered after a hit overrides the
   * kind (killing is the stronger signal).
   */
  register(kind: HitKind): void {
    if (kind === 'kill') this.killCount += 1;
    else this.hitCount += 1;
    this.kind = kind;
    this.flash.start();
  }

  /** Advance the flash; clears the kind once it has fully faded. */
  update(dt: number): void {
    this.flash.update(dt);
    if (this.flash.done && !this.flash.isActive) this.kind = null;
  }

  /** Latest event kind (null until the first event / after fade-out). */
  get latest(): HitKind | null {
    return this.kind;
  }

  /** Flash strength 1 → 0 over the window (0 when idle). */
  get flashValue(): number {
    return this.flash.alpha;
  }

  /** True while a flash is in flight. */
  get active(): boolean {
    return this.kind !== null;
  }

  get hits(): number {
    return this.hitCount;
  }

  get kills(): number {
    return this.killCount;
  }

  /** Zero counters + state (scene reset). */
  reset(): void {
    this.hitCount = 0;
    this.killCount = 0;
    this.kind = null;
    this.flash = new Linger(this.duration, this.duration);
  }
}
