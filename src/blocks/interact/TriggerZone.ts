/**
 * TriggerZone — enter / exit / stay callbacks for a sphere or box region.
 * Pure logic; you tick it yourself. Opt-in.
 */
export type TriggerShape =
  | { kind: 'sphere'; x: number; y?: number; z: number; radius: number }
  | { kind: 'box'; x: number; y?: number; z: number; hx: number; hy?: number; hz: number };

export interface TriggerZoneOpts {
  id?: string;
  shape: TriggerShape;
  /** Return false to ignore this point (e.g. only player). */
  filter?: (tag: string) => boolean;
  onEnter?: (tag: string) => void;
  onExit?: (tag: string) => void;
  /** Fires every tick while inside (throttle yourself if needed). */
  onStay?: (tag: string) => void;
}

export interface TriggerPoint {
  tag: string;
  x: number;
  y?: number;
  z: number;
}

function inside(shape: TriggerShape, p: TriggerPoint): boolean {
  const y = p.y ?? 0;
  if (shape.kind === 'sphere') {
    const dy = y - (shape.y ?? 0);
    const dx = p.x - shape.x;
    const dz = p.z - shape.z;
    return dx * dx + dy * dy + dz * dz <= shape.radius * shape.radius;
  }
  const hy = shape.hy ?? 1e6;
  return (
    Math.abs(p.x - shape.x) <= shape.hx &&
    Math.abs(y - (shape.y ?? 0)) <= hy &&
    Math.abs(p.z - shape.z) <= shape.hz
  );
}

export class TriggerZone {
  readonly id: string;
  private shape: TriggerShape;
  private filter: TriggerZoneOpts['filter'];
  private onEnter?: TriggerZoneOpts['onEnter'];
  private onExit?: TriggerZoneOpts['onExit'];
  private onStay?: TriggerZoneOpts['onStay'];
  private inside = new Set<string>();

  constructor(opts: TriggerZoneOpts) {
    this.id = opts.id ?? 'zone';
    this.shape = opts.shape;
    this.filter = opts.filter;
    this.onEnter = opts.onEnter;
    this.onExit = opts.onExit;
    this.onStay = opts.onStay;
  }

  get occupants(): number {
    return this.inside.size;
  }

  has(tag: string): boolean {
    return this.inside.has(tag);
  }

  /** Call each sim tick with all candidate points. */
  update(points: readonly TriggerPoint[]): void {
    const next = new Set<string>();
    for (const p of points) {
      if (this.filter && !this.filter(p.tag)) continue;
      if (!inside(this.shape, p)) continue;
      next.add(p.tag);
      if (!this.inside.has(p.tag)) this.onEnter?.(p.tag);
      this.onStay?.(p.tag);
    }
    for (const tag of this.inside) {
      if (!next.has(tag)) this.onExit?.(tag);
    }
    this.inside = next;
  }

  reset(): void {
    this.inside.clear();
  }
}
