/**
 * PlaceGrid — snap world XZ to cells and track occupancy. Opt-in.
 */
export interface PlaceGridOpts {
  originX: number;
  originZ: number;
  cell: number;
  width: number;
  height: number;
}

export interface Cell {
  ix: number;
  iz: number;
}

export class PlaceGrid {
  private occupied: Set<string>;
  private o: PlaceGridOpts;

  constructor(opts: PlaceGridOpts) {
    this.o = opts;
    this.occupied = new Set();
  }

  key(ix: number, iz: number): string {
    return `${ix},${iz}`;
  }

  worldToCell(x: number, z: number): Cell {
    return {
      ix: Math.floor((x - this.o.originX) / this.o.cell),
      iz: Math.floor((z - this.o.originZ) / this.o.cell),
    };
  }

  /** Center of cell in world space. */
  cellToWorld(ix: number, iz: number): { x: number; z: number } {
    return {
      x: this.o.originX + (ix + 0.5) * this.o.cell,
      z: this.o.originZ + (iz + 0.5) * this.o.cell,
    };
  }

  inBounds(ix: number, iz: number): boolean {
    return ix >= 0 && iz >= 0 && ix < this.o.width && iz < this.o.height;
  }

  isFree(ix: number, iz: number): boolean {
    return this.inBounds(ix, iz) && !this.occupied.has(this.key(ix, iz));
  }

  isOccupied(ix: number, iz: number): boolean {
    return this.occupied.has(this.key(ix, iz));
  }

  /** Occupy a cell. Returns false if out of bounds or already taken. */
  occupy(ix: number, iz: number): boolean {
    if (!this.isFree(ix, iz)) return false;
    this.occupied.add(this.key(ix, iz));
    return true;
  }

  release(ix: number, iz: number): void {
    this.occupied.delete(this.key(ix, iz));
  }

  /** Snap world point to free cell center, or null. */
  snapFree(x: number, z: number): { x: number; z: number; ix: number; iz: number } | null {
    const c = this.worldToCell(x, z);
    if (!this.isFree(c.ix, c.iz)) return null;
    const w = this.cellToWorld(c.ix, c.iz);
    return { x: w.x, z: w.z, ix: c.ix, iz: c.iz };
  }

  clear(): void {
    this.occupied.clear();
  }

  get occupiedCount(): number {
    return this.occupied.size;
  }
}
