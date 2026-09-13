/**
 * Health — pure hit-point component. Opt-in: construct and tick yourself.
 * No three.js, no globals. Side-effect free module.
 */
export interface HealthOpts {
  max: number;
  hp?: number;
  /** Return true to consume the hit (default: always accept). */
  canDamage?: (amount: number) => boolean;
  onDamage?: (amount: number, remaining: number) => void;
  onDeath?: () => void;
}

export class Health {
  readonly max: number;
  hp: number;
  private canDamage?: HealthOpts['canDamage'];
  private onDamage?: HealthOpts['onDamage'];
  private onDeath?: HealthOpts['onDeath'];

  constructor(opts: HealthOpts) {
    this.max = Math.max(1, opts.max);
    this.hp = opts.hp ?? this.max;
    this.canDamage = opts.canDamage;
    this.onDamage = opts.onDamage;
    this.onDeath = opts.onDeath;
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get ratio(): number {
    return this.hp / this.max;
  }

  /** Returns true if damage was applied (hp may still be > 0). */
  damage(amount: number): boolean {
    if (!this.alive || amount <= 0) return false;
    if (this.canDamage && !this.canDamage(amount)) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.onDamage?.(amount, this.hp);
    if (this.hp === 0) this.onDeath?.();
    return true;
  }

  heal(amount: number): number {
    if (!this.alive || amount <= 0) return this.hp;
    this.hp = Math.min(this.max, this.hp + amount);
    return this.hp;
  }

  /** Full reset (respawn / recycle). */
  revive(hp = this.max): void {
    this.hp = Math.min(this.max, Math.max(1, hp));
  }
}
