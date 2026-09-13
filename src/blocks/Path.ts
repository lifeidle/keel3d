/**
 * Waypoint path follower (spline or polyline).
 * Sample B tower-defense enemies and Sample C quest NPCs walk these.
 */
export interface PathPoint {
  x: number;
  y: number;
  z: number;
}

export class Path {
  private pts: PathPoint[];
  private segLens: number[];
  totalLen: number;

  constructor(points: PathPoint[]) {
    if (points.length < 2) throw new Error('Path needs ≥2 points');
    this.pts = points.map((p) => ({ ...p }));
    this.segLens = [];
    this.totalLen = 0;
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      this.segLens.push(len);
      this.totalLen += len;
    }
  }

  get length(): number {
    return this.pts.length;
  }

  get points(): readonly PathPoint[] {
    return this.pts;
  }

  /** Position at arc-length t ∈ [0, totalLen]. */
  sampleAt(dist: number, out: PathPoint = { x: 0, y: 0, z: 0 }): PathPoint {
    let d = Math.max(0, Math.min(dist, this.totalLen));
    for (let i = 0; i < this.segLens.length; i++) {
      const seg = this.segLens[i];
      if (d <= seg || i === this.segLens.length - 1) {
        const a = this.pts[i];
        const b = this.pts[i + 1];
        const t = seg > 0 ? d / seg : 0;
        out.x = a.x + (b.x - a.x) * t;
        out.y = a.y + (b.y - a.y) * t;
        out.z = a.z + (b.z - a.z) * t;
        return out;
      }
      d -= seg;
    }
    const last = this.pts[this.pts.length - 1];
    out.x = last.x;
    out.y = last.y;
    out.z = last.z;
    return out;
  }

  /** Unit forward direction at arc-length dist (XZ-normalized when possible). */
  sampleDir(dist: number, out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }) {
    const eps = 0.05;
    const a = this.sampleAt(Math.max(0, dist - eps));
    const b = this.sampleAt(Math.min(this.totalLen, dist + eps));
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    out.x = dx / len;
    out.y = dy / len;
    out.z = dz / len;
    return out;
  }

  /** End point (goal). */
  end(out: PathPoint = { x: 0, y: 0, z: 0 }): PathPoint {
    const p = this.pts[this.pts.length - 1];
    out.x = p.x;
    out.y = p.y;
    out.z = p.z;
    return out;
  }
}
