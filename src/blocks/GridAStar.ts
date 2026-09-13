/**
 * Grid A* (optional block). Open-world / RTS obstacle avoidance.
 * Binary heap open set — O(log n) pop instead of sorting every expansion.
 */
export interface GridAStarOpts {
  width: number;
  height: number;
  /** world X of cell (0,0) corner */
  originX: number;
  originZ: number;
  cell: number;
}

interface HeapNode {
  i: number;
  f: number;
}

/** Min-heap by f. */
class MinHeap {
  private a: HeapNode[] = [];
  get size(): number {
    return this.a.length;
  }
  push(i: number, f: number): void {
    const a = this.a;
    a.push({ i, f });
    let c = a.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (a[p].f <= a[c].f) break;
      const t = a[p];
      a[p] = a[c];
      a[c] = t;
      c = p;
    }
  }
  pop(): HeapNode | null {
    const a = this.a;
    if (a.length === 0) return null;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let p = 0;
      for (;;) {
        const l = p * 2 + 1;
        const r = l + 1;
        let m = p;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === p) break;
        const t = a[p];
        a[p] = a[m];
        a[m] = t;
        p = m;
      }
    }
    return top;
  }
}

export class GridAStar {
  private blocked: Uint8Array;
  private w: number;
  private h: number;
  private originX: number;
  private originZ: number;
  private cell: number;

  constructor(opts: GridAStarOpts) {
    this.w = Math.max(1, opts.width | 0);
    this.h = Math.max(1, opts.height | 0);
    this.originX = opts.originX;
    this.originZ = opts.originZ;
    this.cell = Math.max(1e-6, opts.cell);
    this.blocked = new Uint8Array(this.w * this.h);
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  clear(): void {
    this.blocked.fill(0);
  }

  isBlocked(ix: number, iz: number): boolean {
    if (!this.inBounds(ix, iz)) return true;
    return this.blocked[this.idx(ix, iz)] === 1;
  }

  blockCell(ix: number, iz: number): void {
    if (!this.inBounds(ix, iz)) return;
    this.blocked[this.idx(ix, iz)] = 1;
  }

  unblockCell(ix: number, iz: number): void {
    if (!this.inBounds(ix, iz)) return;
    this.blocked[this.idx(ix, iz)] = 0;
  }

  blockWorld(x: number, z: number): void {
    const c = this.cellOf(x, z);
    this.blockCell(c.ix, c.iz);
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

  /** Find a path (world coords). Returns cell centers from start to goal, or null. */
  findPath(sx: number, sz: number, gx: number, gz: number): Array<{ x: number; z: number }> | null {
    const s = this.cellOf(sx, sz);
    const g = this.cellOf(gx, gz);
    if (!this.inBounds(s.ix, s.iz) || !this.inBounds(g.ix, g.iz)) return null;
    if (this.isBlocked(s.ix, s.iz) || this.isBlocked(g.ix, g.iz)) return null;

    const n = this.w * this.h;
    const gScore = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const open = new MinHeap();
    const si = this.idx(s.ix, s.iz);
    const gi = this.idx(g.ix, g.iz);
    gScore[si] = 0;
    open.push(si, this.heur(s.ix, s.iz, g.ix, g.iz));

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

    while (open.size) {
      const cur = open.pop()!;
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
          open.push(ni, ng + this.heur(nx, nz, g.ix, g.iz));
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
