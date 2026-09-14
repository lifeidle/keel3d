/**
 * BeatClock — BPM grid for rhythm games. Pure timing logic.
 */
export type Judge = 'perfect' | 'good' | 'miss';

export interface BeatClockOpts {
  bpm?: number;
  /** hit window seconds for perfect / good */
  perfectWindow?: number;
  goodWindow?: number;
  offset?: number;
}

export class BeatClock {
  private bpm: number;
  private perfectW: number;
  private goodW: number;
  private offset: number;
  private t = 0;
  private beat = 0;
  onBeat?: (n: number) => void;

  constructor(opts: BeatClockOpts = {}) {
    this.bpm = Math.max(20, opts.bpm ?? 120);
    this.perfectW = opts.perfectWindow ?? 0.05;
    this.goodW = opts.goodWindow ?? 0.12;
    this.offset = opts.offset ?? 0;
  }

  get beatDuration(): number {
    return 60 / this.bpm;
  }

  get time(): number {
    return this.t;
  }

  get beatIndex(): number {
    return this.beat;
  }

  /** Phase 0..1 within current beat. */
  get phase(): number {
    const bd = this.beatDuration;
    const local = (this.t + this.offset) % bd;
    return local / bd;
  }

  update(dt: number): void {
    const prev = this.beat;
    this.t += dt;
    this.beat = Math.floor((this.t + this.offset) / this.beatDuration);
    if (this.beat > prev) this.onBeat?.(this.beat);
  }

  /** Judge a hit at current time against the nearest beat. */
  judge(): Judge {
    const bd = this.beatDuration;
    const local = (this.t + this.offset) % bd;
    const dist = Math.min(local, bd - local);
    if (dist <= this.perfectW) return 'perfect';
    if (dist <= this.goodW) return 'good';
    return 'miss';
  }

  reset(): void {
    this.t = 0;
    this.beat = 0;
  }
}
