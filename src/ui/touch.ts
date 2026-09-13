// Mobile touch controls: a virtual joystick, a PUBG-style action cluster, and
// drag-anywhere look. Phones and tablets get a usable FPS layout; desktops are
// untouched.
//
// Implementation notes that matter:
// - Pointer Events, not Touch Events: one code path covers finger and stylus,
//   and `touch-action: none` in CSS stops scroll/zoom/double-tap delay.
// - Every control tracks its OWN pointerId, so moving, looking and firing all
//   work simultaneously (real multi-touch, not a single shared pointer).
// - The look surface spans the whole screen but sits *below* the controls in
//   z-order, so a drag anywhere turns the camera while the joystick zone and
//   buttons keep their own taps.
// - Auto-sprint: pushing the stick past ~85% of its radius sprints. That is the
//   mobile convention and it saves a thumb.
// - No crouch / no ADS buttons: this build has neither mechanic, and a button
//   that does nothing is worse than no button.

import { GyroAim } from './gyro';

/** Touch look is measured in CSS pixels; phone swipes are far shorter than a
 *  mouse sweep, so the raw delta is amplified before the game's own
 *  sensitivity slider is applied on top. */
const LOOK_GAIN = 2.4;

/** Stick deflection past this fraction of the radius counts as a sprint. */
const SPRINT_AT = 0.85;

/** Baseline button diameters (px) at scale 1.0 — the size preset multiplies
 *  these and writes inline styles, which beat the small-screen media queries
 *  so the player's choice always wins. */
const BTN_BASE: Record<string, number> = {
  fire: 84,
  jump: 56,
  reload: 56,
  swap: 52,
  use: 52,
  flare: 46,
  pause: 38,
};

export interface TouchSink {
  setTouchMove(x: number, z: number, sprint: boolean): void;
  addTouchLook(dx: number, dy: number): void;
  setTouchFire(down: boolean): void;
  reload(): void;
  jump(): void;
  swap(): void;
  interact(): void;
  flare(): void;
  pause(): void;
}

/** Phones and tablets. Touch-capable laptops deliberately report false. */
export function isTouchDevice(): boolean {
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    return coarse && (navigator.maxTouchPoints || 0) > 0;
  } catch {
    return 'ontouchstart' in window;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

interface BtnSpec {
  id: string;
  label: string;
  kind: 'hold' | 'tap';
  run: (down: boolean) => void;
}

export class TouchControls {
  private root = el('div', 'tc hidden');
  private look = el('div', 'tc-look');
  private zone = el('div', 'tc-zone');
  private base = el('div', 'tc-base');
  private knob = el('div', 'tc-knob');

  private stickId: number | null = null;
  private lookId: number | null = null;
  private fireId: number | null = null;

  private radius = 58;
  private homeX = 0;
  private homeY = 0;
  private cx = 0;
  private cy = 0;

  private lastLookX = 0;
  private lastLookY = 0;

  private visible = false;
  private onResize = () => this.layout();
  /** Layout preset multiplier (0.8 / 1 / 1.2) from the settings row. */
  private btnScale = 1;
  /** Every action button, so the size preset can restyle them inline. */
  private buttons: HTMLDivElement[] = [];
  /** Base pixel-drag amplification; the settings slider scales it further. */
  private lookGain = LOOK_GAIN;
  private gyro = new GyroAim();

  constructor(private sink: TouchSink) {
    this.root.id = 'touch';
    this.build();
    document.body.appendChild(this.root);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    this.layout();
  }

  private build() {
    // --- look surface (bottom of the stack) ---
    this.root.appendChild(this.look);

    // --- joystick: grab zone, then the visible base + knob ---
    this.root.appendChild(this.zone);
    this.base.appendChild(this.knob);
    this.root.appendChild(this.base);

    this.zone.addEventListener('pointerdown', (e) => this.grabStick(e));
    this.zone.addEventListener('pointermove', (e) => this.moveStick(e));
    this.zone.addEventListener('pointerup', (e) => this.dropStick(e));
    this.zone.addEventListener('pointercancel', (e) => this.dropStick(e));

    this.look.addEventListener('pointerdown', (e) => {
      if (this.lookId !== null) return;
      this.lookId = e.pointerId;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
    });
    this.look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      this.sink.addTouchLook(
        (e.clientX - this.lastLookX) * this.lookGain,
        (e.clientY - this.lastLookY) * this.lookGain
      );
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
    });
    const endLook = (e: PointerEvent) => {
      if (e.pointerId === this.lookId) this.lookId = null;
    };
    this.look.addEventListener('pointerup', endLook);
    this.look.addEventListener('pointercancel', endLook);

    // --- action buttons ---
    const buttons: BtnSpec[] = [
      { id: 'fire', label: 'FIRE', kind: 'hold', run: (d) => this.setFire(d) },
      { id: 'jump', label: 'JUMP', kind: 'tap', run: (d) => d && this.sink.jump() },
      { id: 'reload', label: 'RELOAD', kind: 'tap', run: (d) => d && this.sink.reload() },
      { id: 'swap', label: 'SWAP', kind: 'tap', run: (d) => d && this.sink.swap() },
      { id: 'use', label: 'USE', kind: 'tap', run: (d) => d && this.sink.interact() },
      { id: 'flare', label: 'FLARE', kind: 'tap', run: (d) => d && this.sink.flare() },
      { id: 'pause', label: 'II', kind: 'tap', run: (d) => d && this.sink.pause() },
    ];
    for (const b of buttons) {
      const n = el('div', `tc-btn tc-${b.id}`);
      n.textContent = b.label;
      n.dataset.base = String(BTN_BASE[b.id] ?? 52);
      this.buttons.push(n);
      if (b.kind === 'hold') {
        n.addEventListener('pointerdown', (e) => {
          this.fireId = e.pointerId;
          b.run(true);
          e.preventDefault();
        });
        // sliding off the button, lifting, or a system cancel all stop the burst
        const stop = (e: PointerEvent) => {
          if (e.pointerId !== this.fireId) return;
          this.fireId = null;
          b.run(false);
        };
        n.addEventListener('pointerup', stop);
        n.addEventListener('pointercancel', stop);
        n.addEventListener('pointerleave', stop);
      } else {
        n.addEventListener('pointerdown', (e) => {
          b.run(true);
          n.classList.add('lit');
          e.preventDefault();
        });
        const off = () => n.classList.remove('lit');
        n.addEventListener('pointerup', off);
        n.addEventListener('pointercancel', off);
        n.addEventListener('pointerleave', off);
      }
      this.root.appendChild(n);
    }
  }

  /** Settings slider: 0.3x-2x on top of the base pixel gain. */
  setLookGain(mult: number) {
    this.lookGain = LOOK_GAIN * mult;
  }

  /** Settings slider multiplier for gyro output (0.3-2.0). */
  setGyroGain(mult: number) {
    this.gyro.gainMult = mult;
  }

  /** Gyro toggle from settings. Resolves false when denied/unsupported. */
  async setGyroEnabled(on: boolean): Promise<boolean> {
    if (on) {
      this.gyro.onLook = (dx, dy) => this.sink.addTouchLook(dx, dy);
      return this.gyro.enable();
    }
    this.gyro.disable();
    return true;
  }

  get gyroActive() {
    return this.gyro.active;
  }

  private setFire(down: boolean) {
    this.sink.setTouchFire(down);
    this.root.querySelector('.tc-fire')?.classList.toggle('lit', down);
  }

  /** Size the stick to the screen and park it at its home position. */
  private layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // In landscape the HEIGHT is the tight dimension, so size the stick off it.
    // 13% of a 390px-tall phone is a ~100px pad — big enough for a thumb.
    this.radius = Math.max(46, Math.min(76, Math.min(w, h) * 0.13)) * this.btnScale;
    this.homeX = Math.max(this.radius + 26, w * 0.16);
    this.homeY = h - Math.max(this.radius + 26, h * 0.2);
    const size = this.radius * 2;
    this.base.style.width = `${size}px`;
    this.base.style.height = `${size}px`;
    this.knob.style.width = `${this.radius * 0.86}px`;
    this.knob.style.height = `${this.radius * 0.86}px`;
    this.applyButtonScale();
    if (this.stickId === null) this.parkStick();
  }

  /** Restyle every action button from its baseline size x preset. */
  private applyButtonScale() {
    for (const btn of this.buttons) {
      const px = Number(btn.dataset.base ?? 52) * this.btnScale;
      btn.style.width = `${px}px`;
      btn.style.height = `${px}px`;
    }
  }

  /** Layout preset from settings: 0.8 (small) / 1 (medium) / 1.2 (large). */
  setButtonScale(mult: number) {
    this.btnScale = mult;
    this.applyButtonScale();
    this.layout();
  }

  /** Current preset, for syncing the settings selection. */
  get buttonScale() {
    return this.btnScale;
  }

  private parkStick() {
    this.cx = this.homeX;
    this.cy = this.homeY;
    this.base.style.left = `${this.cx - this.radius}px`;
    this.base.style.top = `${this.cy - this.radius}px`;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.base.classList.remove('grabbed');
  }

  private grabStick(e: PointerEvent) {
    if (this.stickId !== null) return;
    this.stickId = e.pointerId;
    // recentre on the finger: on a phone your thumb is never exactly on the
    // home spot, and a stick that jumps to you feels far better than missing it
    this.cx = Math.min(Math.max(e.clientX, this.radius + 8), window.innerWidth - this.radius - 8);
    this.cy = Math.min(Math.max(e.clientY, this.radius + 8), window.innerHeight - this.radius - 8);
    this.base.style.left = `${this.cx - this.radius}px`;
    this.base.style.top = `${this.cy - this.radius}px`;
    this.base.classList.add('grabbed');
    this.moveStick(e);
    e.preventDefault();
  }

  private moveStick(e: PointerEvent) {
    if (e.pointerId !== this.stickId) return;
    let dx = e.clientX - this.cx;
    let dy = e.clientY - this.cy;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) {
      dx = (dx / d) * this.radius;
      dy = (dy / d) * this.radius;
    }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const mag = Math.min(d, this.radius) / this.radius;
    // up on screen (negative dy) is FORWARD
    this.sink.setTouchMove(dx / this.radius, -dy / this.radius, mag >= SPRINT_AT);
    e.preventDefault();
  }

  private dropStick(e: PointerEvent) {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.sink.setTouchMove(0, 0, false);
    this.parkStick();
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.root.classList.remove('hidden');
    this.layout();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.root.classList.add('hidden');
    // never leave a stick or a trigger stuck on when the overlay leaves
    this.stickId = null;
    this.lookId = null;
    this.fireId = null;
    this.sink.setTouchMove(0, 0, false);
    this.sink.setTouchFire(false);
    this.parkStick();
  }

  dispose() {
    this.hide();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    this.root.remove();
  }
}
