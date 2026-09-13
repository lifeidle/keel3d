/**
 * WorldBar — health/progress bar pinned to a world position (camera project).
 * Opt-in; DOM based.
 */
import * as THREE from 'three';

export class WorldBar {
  readonly el: HTMLElement | null;
  private fill: HTMLElement | null;
  private w: number;
  private h: number;

  constructor(opts: { width?: number; height?: number; color?: string } = {}) {
    this.w = opts.width ?? 48;
    this.h = opts.height ?? 5;
    if (typeof document === 'undefined') {
      this.el = null;
      this.fill = null;
      return;
    }
    const root = document.createElement('div');
    root.style.cssText =
      `position:fixed;z-index:22;width:${this.w}px;height:${this.h}px;` +
      `background:rgba(0,0,0,.55);border-radius:3px;overflow:hidden;pointer-events:none;transform:translate(-50%,-100%);`;
    const fill = document.createElement('div');
    fill.style.cssText = `height:100%;width:100%;background:${opts.color ?? '#5dcea0'}`;
    root.appendChild(fill);
    document.body.appendChild(root);
    this.el = root;
    this.fill = fill;
  }

  setRatio(r: number): void {
    if (!this.fill) return;
    const v = Math.max(0, Math.min(1, r));
    this.fill.style.width = `${v * 100}%`;
    this.fill.style.background = v < 0.3 ? '#e07070' : v < 0.6 ? '#f0a86a' : '#5dcea0';
  }

  /** Hide when behind camera or too far. */
  update(camera: THREE.PerspectiveCamera, world: THREE.Vector3, offsetY = 1.6): void {
    if (!this.el) return;
    const p = world.clone();
    p.y += offsetY;
    p.project(camera);
    if (p.z > 1 || p.z < -1) {
      this.el.style.display = 'none';
      return;
    }
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    this.el.style.display = '';
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }

  setVisible(on: boolean): void {
    if (this.el) this.el.style.display = on ? '' : 'none';
  }

  dispose(): void {
    this.el?.remove();
  }
}
