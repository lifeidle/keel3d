/**
 * GameFeel — hit flash overlay + optional camera shake.
 * Pure DOM overlay; camera shake is a small offset you apply to the camera.
 *
 * R69: `sustain` — a SUSTAINED full-screen tint while a condition holds
 * (low-HP vignette, damage zone…). The flash channel is one-shot; the
 * tint channel ramps in/out linearly while its target stays. Both share
 * the update loop; the tint lives on its own overlay element so a flash
 * and a vignette can overlap without fighting over opacity.
 */
import * as THREE from 'three';

export interface GameFeelHost {
  /** Flash element (one-shot channel). */
  flash?: HTMLElement | null;
  /** Tint element (sustained channel). */
  tint?: HTMLElement | null;
}

export class GameFeel {
  private flash: HTMLElement | null;
  private flashT = 0;
  private shakeT = 0;
  private shakeAmp = 0;
  private tint: HTMLElement | null;
  /** R69: sustained-tint ramp position (0..1). */
  private sustainK = 0;
  private sustainOn = false;
  private sustainCss = 'rgba(255,40,40,0.55)';
  private sustainRamp = 0.4;

  /**
   * @param host optional element host. Omitted → both overlays are created
   * on `document.body` (headless-safe: no document → no-op channels).
   * Pass `{ flash: el, tint: el }` to inject elements (tests) or
   * `null` for a headless channel.
   */
  constructor(host?: GameFeelHost) {
    const headless = typeof document === 'undefined';
    if (!host) {
      this.flash = headless ? null : makeOverlay();
      this.tint = headless ? null : makeOverlay();
    } else {
      this.flash = host.flash ?? null;
      this.tint = host.tint ?? null;
    }
    if (this.tint) {
      this.tint.style.opacity = '0';
      this.tint.style.background = this.sustainCss;
    }
  }

  /** Full-screen flash (damage = red-ish, pickup = gold). */
  flashOnce(color = 'rgba(255,80,80,0.35)', ms = 180): void {
    if (!this.flash) return;
    this.flash.style.background = color;
    this.flashT = ms / 1000;
  }

  /**
   * R69: sustained full-screen tint while `on` is true.
   * @param on target state (true → ramp to 1, false → ramp to 0)
   * @param css background for the tint channel (colour or CSS gradient —
   * a radial gradient makes a proper vignette)
   * @param ramp seconds for a full 0↔1 ramp (both directions)
   */
  setSustain(on: boolean, css?: string, ramp = 0.4): void {
    this.sustainOn = on;
    // content calls this every frame (tracking a state) — only touch the
    // DOM when the css actually changes
    if (css && css !== this.sustainCss) {
      this.sustainCss = css;
      if (this.tint) this.tint.style.background = this.sustainCss;
    }
    this.sustainRamp = Math.max(0.01, ramp);
  }

  /** R69: current tint ramp position (0..1) — probe/stats observable. */
  get sustainLevel(): number {
    return this.sustainK;
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
    // R69: sustained tint — linear ramp toward the target
    const target = this.sustainOn ? 1 : 0;
    const step = dt / this.sustainRamp;
    this.sustainK =
      target > this.sustainK
        ? Math.min(target, this.sustainK + step)
        : Math.max(target, this.sustainK - step);
    if (this.tint) this.tint.style.opacity = String(this.sustainK);
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
    this.tint?.remove();
  }
}

function makeOverlay(): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:0;z-index:35;pointer-events:none;background:#fff;opacity:0;';
  document.body.appendChild(el);
  return el;
}
