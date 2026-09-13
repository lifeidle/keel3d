/**
 * MinimapDots — simple 2D canvas dots. Opt-in.
 */
export interface MapDot {
  x: number;
  z: number;
  color?: string;
}

export class MinimapDots {
  readonly canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private size: number;
  private worldHalf: number;

  constructor(opts: { size?: number; worldHalf?: number } = {}) {
    this.size = opts.size ?? 120;
    this.worldHalf = opts.worldHalf ?? 40;
    if (typeof document === 'undefined') {
      this.canvas = null;
      this.ctx = null;
      return;
    }
    const c = document.createElement('canvas');
    c.width = this.size;
    c.height = this.size;
    c.style.cssText =
      'position:fixed;right:12px;top:12px;z-index:20;border:1px solid rgba(255,255,255,.25);border-radius:8px;background:rgba(0,0,0,.45)';
    document.body.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');
  }

  /** dots in world XZ; playerX/Z is center marker. */
  render(dots: readonly MapDot[], playerX: number, playerZ: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = this.size;
    ctx.clearRect(0, 0, s, s);
    const to = (wx: number, wz: number) => ({
      px: ((wx + this.worldHalf) / (this.worldHalf * 2)) * s,
      py: ((wz + this.worldHalf) / (this.worldHalf * 2)) * s,
    });
    for (const d of dots) {
      const { px, py } = to(d.x, d.z);
      ctx.fillStyle = d.color ?? '#ffd27a';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = to(playerX, playerZ);
    ctx.fillStyle = '#6ec8ff';
    ctx.beginPath();
    ctx.arc(p.px, p.py, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  dispose(): void {
    this.canvas?.remove();
  }
}
