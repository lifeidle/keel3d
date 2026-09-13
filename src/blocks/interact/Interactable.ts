/**
 * Interactable — F-key style object with range + hint + one-shot use.
 * Pure logic. Opt-in.
 */
export interface InteractableOpts {
  id: string;
  x: number;
  y?: number;
  z: number;
  /** Interaction radius. */
  radius?: number;
  /** Hint shown when in range (content may localize). */
  hint?: string;
  /** Max uses; Infinity = unlimited. */
  uses?: number;
  cooldown?: number;
  onUse?: (id: string, usesLeft: number) => void;
  /** Return false to block use. */
  canUse?: () => boolean;
}

export class Interactable {
  readonly id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  hint: string;
  usesLeft: number;
  cooldown: number;
  private cd = 0;
  private onUse?: InteractableOpts['onUse'];
  private canUse?: InteractableOpts['canUse'];

  constructor(opts: InteractableOpts) {
    this.id = opts.id;
    this.x = opts.x;
    this.y = opts.y ?? 0;
    this.z = opts.z;
    this.radius = opts.radius ?? 2.5;
    this.hint = opts.hint ?? 'Interact';
    this.usesLeft = opts.uses ?? 1;
    this.cooldown = opts.cooldown ?? 0;
    this.onUse = opts.onUse;
    this.canUse = opts.canUse;
  }

  get available(): boolean {
    return this.usesLeft > 0 && this.cd <= 0;
  }

  inRange(px: number, pz: number, py = 0): boolean {
    return Math.hypot(px - this.x, pz - this.z, py - this.y) <= this.radius;
  }

  update(dt: number): void {
    if (this.cd > 0) this.cd = Math.max(0, this.cd - dt);
  }

  /** Call on interact key when in range. */
  tryUse(px: number, pz: number, py = 0): boolean {
    if (!this.available || !this.inRange(px, pz, py)) return false;
    if (this.canUse && !this.canUse()) return false;
    this.usesLeft--;
    this.cd = this.cooldown;
    this.onUse?.(this.id, this.usesLeft);
    return true;
  }
}
