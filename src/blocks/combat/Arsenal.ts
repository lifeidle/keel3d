/**
 * Arsenal — multi-slot weapon bookkeeping (ammo, cooldown, swap, recoil).
 * Pure state; content layer applies damage/effects when update() returns 'fired'.
 */
import { Magazine } from './Magazine';

export interface ArsenalSlotDef {
  key: string;
  magSize: number;
  reserve: number;
  reloadTime: number;
  /** shots per second */
  fireRate: number;
  auto: boolean;
}

export type FireOutcome = 'fired' | 'empty' | 'reloading' | 'cooldown' | 'idle';

export interface ArsenalOpts {
  /** Seconds locked out after switchTo. Default 0.25. */
  swapCooldown?: number;
  /** Recoil decay per second in decayRecoil. Default 0.12. */
  recoilDecay?: number;
}

export class Arsenal {
  private slots: ArsenalSlotDef[];
  private mags: Magazine[];
  private cur = 0;
  private cooldown = 0;
  private kick = 0;
  private swapCd: number;
  private recoilDecay: number;

  constructor(slots: ArsenalSlotDef[], opts: ArsenalOpts = {}) {
    if (!slots.length) throw new Error('[Arsenal] needs at least one slot');
    this.slots = slots.slice();
    this.mags = slots.map((s) => new Magazine(s.magSize, s.magSize, s.reserve));
    this.swapCd = opts.swapCooldown ?? 0.25;
    this.recoilDecay = opts.recoilDecay ?? 0.12;
  }

  get index(): number {
    return this.cur;
  }

  get def(): ArsenalSlotDef {
    return this.slots[this.cur];
  }

  get mag(): number {
    return this.mags[this.cur].rounds;
  }

  get reserve(): number {
    return this.mags[this.cur].reserve;
  }

  get reloading(): boolean {
    return this.mags[this.cur].reloading;
  }

  get cooldownRemaining(): number {
    return Math.max(0, this.cooldown);
  }

  get recoil(): number {
    return this.kick;
  }

  get slotCount(): number {
    return this.slots.length;
  }

  slotDef(i: number): ArsenalSlotDef {
    return this.slots[i];
  }

  /**
   * Advance cooldown + reload. When a shot is due, consumes one round and
   * returns 'fired' — caller applies damage/effects.
   * Empty mag with reserve > 0 auto-starts reload and returns 'empty'.
   */
  update(dt: number, held: boolean, clicked: boolean): FireOutcome {
    if (this.cooldown > 0) this.cooldown -= dt;

    const mag = this.mags[this.cur];
    if (mag.reloading) {
      mag.tick(dt);
      return 'reloading';
    }

    const trigger = this.def.auto ? held : clicked;
    if (!trigger || this.cooldown > 0) {
      return trigger ? 'cooldown' : 'idle';
    }

    if (mag.empty) {
      if (mag.reserve > 0) {
        mag.startReload(this.def.reloadTime);
        return 'empty';
      }
      this.cooldown = 0.5;
      return 'empty';
    }

    mag.consume();
    this.cooldown = 1 / this.def.fireRate;
    return 'fired';
  }

  reload(): boolean {
    const mag = this.mags[this.cur];
    const was = mag.reloading;
    mag.startReload(this.def.reloadTime);
    return !was && mag.reloading;
  }

  /** Switch slot (wraps). Cancels reload, brief swap cooldown. */
  switchTo(index: number): boolean {
    const n = this.slots.length;
    const idx = ((index % n) + n) % n;
    if (idx === this.cur) return false;
    this.mags[this.cur].cancelReload();
    this.cur = idx;
    this.cooldown = this.swapCd;
    this.kick = 0;
    return true;
  }

  reset(): void {
    this.mags = this.slots.map((s) => new Magazine(s.magSize, s.magSize, s.reserve));
    this.cur = 0;
    this.cooldown = 0;
    this.kick = 0;
  }

  refillAll(): void {
    for (let i = 0; i < this.slots.length; i++) {
      this.mags[i].refillReserve(this.slots[i].reserve);
    }
  }

  addRecoil(n: number): void {
    this.kick += n;
  }

  /** Decay recoil toward 0; returns the remaining value. */
  decayRecoil(dt: number, rate = this.recoilDecay): number {
    if (this.kick > 0) this.kick = Math.max(0, this.kick - dt * rate);
    return this.kick;
  }
}
