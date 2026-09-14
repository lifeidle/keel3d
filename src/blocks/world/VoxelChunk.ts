/**
 * VoxelChunk — sparse block grid for sandbox editing. Pure data + mesh build hook.
 */
export interface VoxelOpts {
  size?: number;
  cell?: number;
}

export type VoxelMap = Map<string, number>; // key x,y,z → color id

export class VoxelChunk {
  readonly size: number;
  readonly cell: number;
  private blocks: VoxelMap = new Map();
  onChange?: () => void;

  constructor(opts: VoxelOpts = {}) {
    this.size = Math.max(4, opts.size ?? 16);
    this.cell = opts.cell ?? 1;
  }

  key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  get count(): number {
    return this.blocks.size;
  }

  inBounds(x: number, y: number, z: number): boolean {
    const h = this.size / 2;
    return x >= -h && x < h && y >= 0 && y < this.size && z >= -h && z < h;
  }

  get(x: number, y: number, z: number): number {
    return this.blocks.get(this.key(x, y, z)) ?? 0;
  }

  set(x: number, y: number, z: number, id: number): boolean {
    if (!this.inBounds(x, y, z)) return false;
    if (id === 0) this.blocks.delete(this.key(x, y, z));
    else this.blocks.set(this.key(x, y, z), id);
    this.onChange?.();
    return true;
  }

  remove(x: number, y: number, z: number): boolean {
    const had = this.blocks.delete(this.key(x, y, z));
    if (had) this.onChange?.();
    return had;
  }

  /** Iterate occupied cells. */
  forEach(fn: (x: number, y: number, z: number, id: number) => void): void {
    for (const [k, id] of this.blocks) {
      const [x, y, z] = k.split(',').map(Number);
      fn(x, y, z, id);
    }
  }

  clear(): void {
    this.blocks.clear();
    this.onChange?.();
  }

  /** Flat positions for InstancedMesh: [x,y,z,id,...] */
  toInstanceData(): number[] {
    const out: number[] = [];
    this.forEach((x, y, z, id) => {
      out.push(x, y, z, id);
    });
    return out;
  }
}
