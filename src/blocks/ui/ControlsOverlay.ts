/**
 * ControlsOverlay — start-of-game controls hint.
 *
 * Shown at boot (bottom centre, above the HUD), auto-hides after `duration`
 * seconds (0 = stay until clicked) or on any click of the panel.
 * Add `controls.system` to the recipe's systems for the auto-hide timer.
 *
 * Use `footer` for a "desktop recommended" note on genres without touch
 * support. DOM-tolerant: harmless to construct without a document.
 */
import type { System } from '../../engine/types';

export interface ControlHint {
  /** e.g. ['W','A','S','D'] or ['鼠标'] — joined with spaces in the UI. */
  keys: string[];
  label: string;
}

export interface ControlsOverlayOptions {
  title?: string;
  hints: ControlHint[];
  /** Optional bottom note, e.g. '桌面设备体验更佳'. */
  footer?: string;
  /** Auto-hide seconds; 0 disables the timer. Default 6. */
  duration?: number;
  /** Show on construction. Default true. */
  showOnBoot?: boolean;
}

export class ControlsOverlay {
  private el: HTMLElement | null = null;
  private tLeft: number;
  private duration: number;
  private visible = false;
  private disposed = false;

  /** Frame hook — append to the recipe's systems array. */
  readonly system: System;

  constructor(opts: ControlsOverlayOptions) {
    this.duration = opts.duration ?? 6;
    this.tLeft = this.duration;

    this.system = {
      name: 'controls.hint',
      update: (ft: number) => {
        if (!this.visible || this.duration <= 0) return;
        this.tLeft -= ft;
        if (this.tLeft <= 0) this.hide();
      },
      dispose: () => this.dispose(),
    };

    if (typeof document !== 'undefined') {
      this.el = this.build(opts);
    }
    if (opts.showOnBoot !== false) this.show();
  }

  get shown(): boolean {
    return this.visible;
  }

  show(): void {
    if (this.visible || !this.el) return;
    this.tLeft = this.duration;
    this.visible = true;
    this.el.style.display = 'block';
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    if (this.el) this.el.style.display = 'none';
  }

  private build(opts: ControlsOverlayOptions): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:30;' +
      'background:rgba(10,14,18,.88);border:1px solid rgba(255,255,255,.14);border-radius:10px;' +
      'padding:12px 18px;color:#e8eef2;font:13px/1.7 system-ui,sans-serif;pointer-events:auto;' +
      'display:none;min-width:260px;';
    // Dismiss on click, and swallow the event: several recipes act on a
    // window-level `click` (build / place / select), and a tap on this panel
    // must not reach them.
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    const title = document.createElement('div');
    title.textContent = opts.title ?? '操作说明';
    title.style.cssText = 'font-size:13px;font-weight:700;letter-spacing:.1em;opacity:.85;margin-bottom:6px;';
    el.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:auto auto;column-gap:18px;row-gap:2px;text-align:left;';
    for (const h of opts.hints) {
      const k = document.createElement('div');
      k.textContent = h.keys.join(' ');
      k.style.cssText = 'opacity:.95;';
      const l = document.createElement('div');
      l.textContent = h.label;
      l.style.cssText = 'opacity:.7;';
      grid.appendChild(k);
      grid.appendChild(l);
    }
    el.appendChild(grid);

    if (opts.footer) {
      const f = document.createElement('div');
      f.textContent = opts.footer;
      f.style.cssText = 'margin-top:8px;font-size:11px;opacity:.55;';
      el.appendChild(f);
    }

    document.body.appendChild(el);
    return el;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.el?.remove();
    this.el = null;
    this.visible = false;
  }
}
