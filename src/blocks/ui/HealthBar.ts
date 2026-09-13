/**
 * HealthBar — simple screen-space bar via CSS (world→screen needs camera;
 * this helper draws a 2D bar you position, or follow via project callback).
 */
export interface HealthBarOpts {
  width?: number;
  height?: number;
  color?: string;
  bg?: string;
}

export class HealthBar {
  readonly el: HTMLElement | null;
  private fill: HTMLElement | null;
  private w: number;

  constructor(opts: HealthBarOpts = {}) {
    this.w = opts.width ?? 48;
    const h = opts.height ?? 5;
    if (typeof document === 'undefined') {
      this.el = null;
      this.fill = null;
      return;
    }
    const root = document.createElement('div');
    root.style.cssText =
      `width:${this.w}px;height:${h}px;background:${opts.bg ?? 'rgba(0,0,0,.55)'};` +
      `border-radius:3px;overflow:hidden;pointer-events:none;`;
    const fill = document.createElement('div');
    fill.style.cssText =
      `height:100%;width:100%;background:${opts.color ?? '#5dcea0'};transition:width .1s linear;`;
    root.appendChild(fill);
    this.el = root;
    this.fill = fill;
  }

  /** ratio 0..1 */
  setRatio(ratio: number): void {
    if (!this.fill) return;
    const r = Math.max(0, Math.min(1, ratio));
    this.fill.style.width = `${r * 100}%`;
    this.fill.style.background = r < 0.3 ? '#e07070' : r < 0.6 ? '#f0a86a' : '#5dcea0';
  }

  setHp(hp: number, max: number): void {
    this.setRatio(max > 0 ? hp / max : 0);
  }

  dispose(): void {
    this.el?.remove();
  }
}
