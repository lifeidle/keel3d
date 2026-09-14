/**
 * PauseMenu — reusable pause shell for recipe games (Esc / gamepad Start).
 *
 * Trigger sources:
 * - Esc keydown (when not pointer-locked; the browser swallows Esc while
 *   locked and releases the lock instead — that release is the reliable
 *   "player hit Esc" signal, so pointerlockchange pauses as well).
 * - Gamepad Start rising edge (polled by `system` each frame).
 *
 * Overlay actions: continue / restart (location.reload) / back to hub.
 *
 * Pause authority is the `paused` flag, NOT `world.playing` — the host's
 * autoplay system forces `world.playing = true` every frame. Recipes gate
 * their sim with `!pause.paused` and add `pause.system` to their systems.
 *
 * DOM-tolerant: state transitions work without a document (Node tests);
 * all DOM access is guarded.
 */
import type { System } from '../../engine/types';
import { Gamepad } from '../input/Gamepad';

export interface PauseMenuOptions {
  /** Overlay title; defaults to the document title. */
  title?: string;
  /** Where 返回 hub goes. Demo pages all sit beside hub.html. */
  hubUrl?: string;
  /** Gate — pausing is only allowed while this returns true. */
  active?: () => boolean;
  /** Called on every pause/resume. */
  onToggle?: (paused: boolean) => void;
}

const BTN_CSS =
  'display:block;width:180px;margin:8px auto;padding:9px 0;border:1px solid rgba(255,255,255,.22);' +
  'border-radius:6px;background:rgba(255,255,255,.06);color:#e8eef2;font:14px system-ui,sans-serif;' +
  'cursor:pointer;';

export class PauseMenu {
  /** Recipe gate — freeze your sim while true. */
  paused = false;
  /** Frame hook — append to the recipe's systems array. */
  readonly system: System;

  private title: string;
  private hubUrl: string;
  private active: () => boolean;
  private onToggle?: (paused: boolean) => void;
  private overlay: HTMLElement | null = null;
  private gp = new Gamepad();
  private prevStart = false;
  private disposed = false;

  constructor(opts: PauseMenuOptions = {}) {
    this.title = opts.title ?? (typeof document !== 'undefined' ? document.title : 'Paused');
    this.hubUrl = opts.hubUrl ?? 'hub.html';
    this.active = opts.active ?? (() => true);
    this.onToggle = opts.onToggle;

    this.system = {
      name: 'pause.menu',
      update: () => {
        this.pollGamepad();
      },
      dispose: () => this.dispose(),
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeydown);
      document.addEventListener('pointerlockchange', this.onLockChange);
    }
  }

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') this.toggle();
  };

  private onLockChange = (): void => {
    // Esc while pointer-locked releases the lock without delivering a keydown.
    if (!document.pointerLockElement && !this.paused) this.pause();
  };

  private pollGamepad(): void {
    this.gp.poll();
    const start = this.gp.btn('start');
    if (start && !this.prevStart) this.toggle();
    this.prevStart = start;
  }

  pause(): void {
    if (this.paused || !this.active()) return;
    this.paused = true;
    this.showOverlay();
    this.onToggle?.(true);
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.hideOverlay();
    this.onToggle?.(false);
  }

  toggle(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  /** Restart the page (standard recipe restart). */
  restart(): void {
    if (typeof location !== 'undefined') location.reload();
  }

  /** Go back to the demo hub. */
  hub(): void {
    if (typeof location !== 'undefined') location.href = this.hubUrl;
  }

  private showOverlay(): void {
    if (typeof document === 'undefined') return;
    if (!this.overlay) this.overlay = this.buildOverlay();
    this.overlay.style.display = 'flex';
  }

  private hideOverlay(): void {
    if (this.overlay) this.overlay.style.display = 'none';
  }

  private buildOverlay(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:45;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,.5);';
    // Swallow clicks so they never reach recipe window handlers
    // (build / place / select) behind the overlay.
    el.addEventListener('click', (e) => e.stopPropagation());

    const box = document.createElement('div');
    box.style.cssText =
      'min-width:230px;padding:22px 30px;background:rgba(10,14,18,.94);' +
      'border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#e8eef2;' +
      'font:14px/1.6 system-ui,sans-serif;text-align:center;';

    const title = document.createElement('div');
    title.textContent = this.title;
    title.style.cssText = 'font-size:20px;font-weight:700;letter-spacing:.12em;margin-bottom:14px;';
    box.appendChild(title);

    const makeBtn = (label: string, run: () => void, primary: boolean): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = primary
        ? BTN_CSS.replace('background:rgba(255,255,255,.06);', 'background:rgba(93,206,160,.18);')
        : BTN_CSS;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        run();
      });
      return b;
    };

    box.appendChild(makeBtn('继 续', () => this.resume(), true));
    box.appendChild(makeBtn('重新开始', () => this.restart(), false));
    box.appendChild(makeBtn('返回 hub', () => this.hub(), false));

    const hint = document.createElement('div');
    hint.textContent = 'Esc / 手柄 Start 继续';
    hint.style.cssText = 'margin-top:14px;opacity:.55;font-size:12px;';
    box.appendChild(hint);

    el.appendChild(box);
    document.body.appendChild(el);
    return el;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeydown);
      document.removeEventListener('pointerlockchange', this.onLockChange);
    }
    this.overlay?.remove();
    this.overlay = null;
  }
}
