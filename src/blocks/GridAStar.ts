/**
 * Grid A* + string-pull smoothing (optional block).
 * Open-world / RTS style obstacle avoidance. Not imported by FPS/tower samples.
 */
export interface GridAStarOpts {
  width: number;
  height: number;
  /** world X of cell (0,0) corner */
  originX: number;
  originZ: number;
  cell: number;
}

export class GridAStar {
  private blocked: Uint8Array;
  private w: number;
  private h: number;
  private originX: number;
  private originZ: number;
  private cell: number;

  constructor(opts: GridAStarOpts) {
    this.w = opts.width;
    this.h = opts.height;
    this.originX = opts.originX;
    this.originZ = opts.originZ;
    this.cell = opts.cell;
    this.blocked = new Uint8Array(this.w * this.h);
  }

  clear(): void {
    this.blocked.fill(0);
  }

  blockCell(ix: number, iz: number): void {
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return;
    this.blocked[iz * this.w + ix] = 1;
  }

  blockWorld(x: number, z: number): void {
    const ix = Math.floor((x - this.originX) / this.cell);
    const iz = Math.floor((z - this.originZ) / this.cell);
    this.blockCell(ix, iz);
  }

  private idx(ix: number, iz: number): number {
    return iz * this.w + ix;
  }

  worldOf(ix: number, iz: number): { x: number; z: number } {
    return {
      x: this.originX + (ix + 0.5) * this.cell,
      z: this.originZ + (iz + 0.5) * this.cell,
    };
  }

  private cellOf(x: number, z: number): { ix: number; iz: number } {
    return {
      ix: Math.floor((x - this.originX) / this.cell),
      iz: Math.floor((z - this.originZ) / this.cell),
    };
  }

  /**
   * Find a path from start to goal (world coords). Returns waypoints or null.
   */
  findPath(sx: number, sz: number, gx: number, gz: number): Array<{ x: number; z: number }> | null {
    const s = this.cellOf(sx, sz);
    const g = this.cellOf(gx, gz);
    if (!this.inBounds(s.ix, s.iz) || !this.inBounds(g.ix, g.iz)) return null;
    if (this.blocked[this.idx(s.ix, s.iz)] || this.blocked[this.idx(g.ix, g.iz)]) return null;

    const n = this.w * this.h;
    const gScore = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const open: Array<{ i: number; f: number }> = [];
    const si = this.idx(s.ix, s.iz);
    const gi = this.idx(g.ix, g.iz);
    gScore[si] = 0;
    open.push({ i: si, f: this.heur(s.ix, s.iz, g.ix, g.iz) });

    const dirs = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [-1, -1, Math.SQRT2],
    ] as const;

    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift()!;
      if (cur.i === gi) return this.reconstruct(came, gi);
      const cx = cur.i % this.w;
      const cz = (cur.i / this.w) | 0;
      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!this.inBounds(nx, nz)) continue;
        const ni = this.idx(nx, nz);
        if (this.blocked[ni]) continue;
        const ng = gScore[cur.i] + cost;
        if (ng < gScore[ni]) {
          gScore[ni] = ng;
          came[ni] = cur.i;
          open.push({ i: ni, f: ng + this.heur(nx, nz, g.ix, g.iz) });
        }
      }
    }
    return null;
  }

  private inBounds(ix: number, iz: number): boolean {
    return ix >= 0 && iz >= 0 && ix < this.w && iz < this.h;
  }

  private heur(ax: number, az: number, bx: number, bz: number): number {
    return Math.hypot(bx - ax, bz - az);
  }

  private reconstruct(came: Int32Array, gi: number): Array<{ x: number; z: number }> {
    const cells: number[] = [];
    let i = gi;
    while (i >= 0) {
      cells.push(i);
      i = came[i];
    }
    cells.reverse();
    return cells.map((ci) => this.worldOf(ci % this.w, (ci / this.w) | 0));
  }
}
