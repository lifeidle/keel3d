/**
 * GameFeel — hit flash overlay + optional camera shake.
 * Pure DOM overlay; camera shake is a small offset you apply to the camera.
 */
import * as THREE from 'three';

export class GameFeel {
  private flash: HTMLElement | null;
  private flashT = 0;
  private shakeT = 0;
  private shakeAmp = 0;

  constructor() {
    if (typeof document === 'undefined') {
      this.flash = null;
      return;
    }
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:35;pointer-events:none;background:#fff;opacity:0;';
    document.body.appendChild(el);
    this.flash = el;
  }

  /** Full-screen flash (damage = red-ish, pickup = gold). */
  flashOnce(color = 'rgba(255,80,80,0.35)', ms = 180): void {
    if (!this.flash) return;
    this.flash.style.background = color;
    this.flashT = ms / 1000;
  }

  /** Kick camera for `amp` world units, decaying over `sec`. */
  shake(amp = 0.15, sec = 0.25): void {
    this.shakeAmp = amp;
    this.shakeT = sec;
  }

  /** Call each frame; returns camera offset to add (0,0,0) when idle. */
  update(dt: number): { x: number; y: number } {
    if (this.flash && this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT / 0.18);
      this.flash.style.opacity = String(Math.min(1, k));
    }
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / 0.25) * this.shakeAmp;
      return {
        x: (Math.random() - 0.5) * 2 * k,
        y: (Math.random() - 0.5) * 2 * k,
      };
    }
    return { x: 0, y: 0 };
  }

  /** Apply shake offset onto a camera (call after rig.update). */
  applyToCamera(camera: THREE.PerspectiveCamera, off: { x: number; y: number }): void {
    if (off.x === 0 && off.y === 0) return;
    camera.position.x += off.x;
    camera.position.y += off.y;
  }

  dispose(): void {
    this.flash?.remove();
  }
}
