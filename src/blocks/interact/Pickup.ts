/**
 * Pickup — proximity collectible with optional key interaction.
 * Pure logic + callbacks. Opt-in.
 */
export interface PickupOpts {
  id?: string;
  x: number;
  y?: number;
  z: number;
  /** Collect radius. */
  radius?: number;
  /** Auto-collect on enter (default true). */
  auto?: boolean;
  /** If auto=false, require this flag (e.g. interact key). */
  collected?: boolean;
  onCollect?: (id: string) => void;
}

export class Pickup {
  readonly id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  auto: boolean;
  collected = false;
  private onCollect?: PickupOpts['onCollect'];

  constructor(opts: PickupOpts) {
    this.id = opts.id ?? 'pickup';
    this.x = opts.x;
    this.y = opts.y ?? 0;
    this.z = opts.z;
    this.radius = opts.radius ?? 1.5;
    this.auto = opts.auto !== false;
    this.collected = !!opts.collected;
    this.onCollect = opts.onCollect;
  }

  distanceTo(px: number, pz: number, py = 0): number {
    const dy = py - this.y;
    return Math.hypot(px - this.x, pz - this.z, dy);
  }

  inRange(px: number, pz: number, py = 0): boolean {
    if (this.collected) return false;
    return this.distanceTo(px, pz, py) <= this.radius;
  }

  /** Try collect; returns true if newly collected. */
  tryCollect(px: number, pz: number, py = 0, force = false): boolean {
    if (this.collected) return false;
    if (!force && !this.inRange(px, pz, py)) return false;
    this.collected = true;
    this.onCollect?.(this.id);
    return true;
  }

  reset(): void {
    this.collected = false;
  }
}

/** Batch helper: tick many pickups; auto or manual. */
export class PickupField {
  private items: Pickup[] = [];

  constructor(items: Pickup[] = []) {
    this.items = items;
  }

  add(p: Pickup): void {
    this.items.push(p);
  }

  get count(): number {
    return this.items.length;
  }

  get collectedCount(): number {
    return this.items.reduce((n, p) => n + (p.collected ? 1 : 0), 0);
  }

  get remaining(): number {
    return this.count - this.collectedCount;
  }

  /** Auto-collect those in range. */
  update(px: number, pz: number, py = 0): number {
    let n = 0;
    for (const p of this.items) {
      if (p.auto && p.tryCollect(px, pz, py)) n++;
    }
    return n;
  }

  /** Manual: collect nearest in range (for interact key). */
  collectNearest(px: number, pz: number, py = 0, maxDist?: number): Pickup | null {
    let best: Pickup | null = null;
    let bestD = maxDist ?? Infinity;
    for (const p of this.items) {
      if (p.collected) continue;
      const d = p.distanceTo(px, pz, py);
      if (d <= (maxDist ?? p.radius) && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) best.tryCollect(px, pz, py, true);
    return best;
  }

  list(): readonly Pickup[] {
    return this.items;
  }

  resetAll(): void {
    for (const p of this.items) p.reset();
  }
}
