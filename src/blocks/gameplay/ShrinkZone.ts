/**
 * ShrinkZone — BR-lite safe circle. Pure math.
 */
export class ShrinkZone {
  private _cx = 0;
  private _cz = 0;
  private _radius: number;
  private targetR: number;
  private minR: number;
  private rate: number;
  private delayT = 0;
  private delay: number;

  constructor(opts: { radius?: number; minRadius?: number; rate?: number; delay?: number; cx?: number; cz?: number } = {}) {
    this._cx = opts.cx ?? 0;
    this._cz = opts.cz ?? 0;
    this._radius = opts.radius ?? 30;
    this.targetR = this._radius;
    this.minR = opts.minRadius ?? 6;
    this.rate = opts.rate ?? 0.4;
    this.delay = opts.delay ?? 8;
    this.delayT = this.delay;
  }

  get cx(): number {
    return this._cx;
  }
  get cz(): number {
    return this._cz;
  }
  get radius(): number {
    return this._radius;
  }

  /** Start next shrink step. */
  shrinkStep(amount = 4): void {
    this.targetR = Math.max(this.minR, this.targetR - amount);
  }

  update(dt: number): void {
    this.delayT -= dt;
    if (this.delayT <= 0 && this._radius > this.targetR) {
      this._radius = Math.max(this.targetR, this._radius - this.rate * dt);
    }
    if (this.delayT <= 0 && this._radius <= this.targetR + 0.01 && this.targetR > this.minR) {
      this.delayT = this.delay;
    }
  }

  contains(x: number, z: number): boolean {
    return Math.hypot(x - this._cx, z - this._cz) <= this._radius;
  }

  /** Damage per second when outside (caller applies). */
  outsideDps = 4;
}
