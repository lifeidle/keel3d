// Generic mobile touch surface: virtual joystick, drag-anywhere look, and a
// configurable action-button cluster. Phones and tablets get a usable layout;
// desktops are untouched (see isTouchDevice).
//
// Implementation notes that matter:
// - Pointer Events, not Touch Events: one code path covers finger and stylus,
//   and `touch-action: none` in CSS stops scroll/zoom/double-tap delay.
// - Every control tracks its OWN pointerId, so moving, looking and firing all
//   work simultaneously (real multi-touch, not a single shared pointer).
// - The look surface spans the whole screen but sits *below* the controls in
//   z-order, so a drag anywhere turns the camera while the joystick zone and
//   buttons keep their own taps.
// - Auto-sprint: pushing the stick past ~85% of its radius sprints.
// - Styles come from the global `.tc-*` classes in src/styles.css.

import { GyroAim } from '../../ui/gyro';

/** Touch look is measured in CSS pixels; phone swipes are far shorter than a
 *  mouse sweep, so the raw delta is amplified before the game's own
 *  sensitivity is applied on top. */
const LOOK_GAIN = 2.4;

/** Stick deflection past this fraction of the radius counts as a sprint. */
const SPRINT_AT = 0.85;

export interface TouchLookSink {
  /** Stick vector (x = right, z = forward) + auto-sprint flag. */
  setMove(x: number, z: number, sprint: boolean): void;
  /** Look delta in amplified CSS pixels. */
  addLook(dx: number, dy: number): void;
  /** Primary fire held/down (FIRE button or equivalent). */
  setFire(down: boolean): void;
}

export interface ActionButtonDef {
  id: string;
  label: string;
  /** hold = onDown on press, onUp on release; tap = onDown once on press. */
  kind: 'hold' | 'tap';
  onDown: () => void;
  onUp: () => void;
  /** Diameter in px at scale 1.0. Default 52. */
  size?: number;
}

export interface TouchControlsOptions {
  sink: TouchLookSink;
  buttons: ActionButtonDef[];
}

/** Phones and tablets. Touch-capable laptops deliberately report false. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
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

interface BtnState {
  def: ActionButtonDef;
  node: HTMLDivElement;
  pointerId: number | null;
}

export class TouchControls {
  private root = el('div', 'tc hidden');
  private look = el('div', 'tc-look');
  private zone = el('div', 'tc-zone');
  private base = el('div', 'tc-base');
  private knob = el('div', 'tc-knob');

  private stickId: number | null = null;
  private lookId: number | null = null;

  private radius = 58;
  private homeX = 0;
  private homeY = 0;
  private cx = 0;
  private cy = 0;

  private lastLookX = 0;
  private lastLookY = 0;

  private visible = false;
  private onResize = () => this.layout();
  /** Layout preset multiplier (0.8 / 1 / 1.2). */
  private btnScale = 1;
  /** Every action button, so the size preset can restyle them inline. */
  private buttons: BtnState[] = [];
  /** Base pixel-drag amplification; a multiplier scales it further. */
  private lookGain = LOOK_GAIN;
  private gyro = new GyroAim();

  constructor(private sink: TouchLookSink, defs: ActionButtonDef[]) {
    this.root.id = 'touch';
    this.build(defs);
    document.body.appendChild(this.root);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    this.layout();
  }

  private build(defs: ActionButtonDef[]) {
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
      this.sink.addLook(
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

    // --- action buttons, each tracking its own pointer ---
    for (const def of defs) {
      const node = el('div', `tc-btn tc-${def.id}`);
      node.textContent = def.label;
      node.dataset.base = String(def.size ?? 52);
      const state: BtnState = { def, node, pointerId: null };

      node.addEventListener('pointerdown', (e) => {
        if (state.pointerId !== null) return;
        state.pointerId = e.pointerId;
        node.classList.add('lit');
        def.onDown();
        e.preventDefault();
      });
      const stop = (e: PointerEvent) => {
        if (e.pointerId !== state.pointerId) return;
        state.pointerId = null;
        node.classList.remove('lit');
        if (def.kind === 'hold') def.onUp();
      };
      node.addEventListener('pointerup', stop);
      node.addEventListener('pointercancel', stop);
      node.addEventListener('pointerleave', stop);

      this.buttons.push(state);
      this.root.appendChild(node);
    }
  }

  /** Sensitivity multiplier on top of the base pixel gain (0.3x-2x). */
  setLookGain(mult: number) {
    this.lookGain = LOOK_GAIN * mult;
  }

  /** Multiplier for gyro output (0.3-2.0). */
  setGyroGain(mult: number) {
    this.gyro.gainMult = mult;
  }

  /** Gyro enable from settings. Resolves false when denied/unsupported. */
  async setGyroEnabled(on: boolean): Promise<boolean> {
    if (on) {
      this.gyro.onLook = (dx, dy) => this.sink.addLook(dx, dy);
      return this.gyro.enable();
    }
    this.gyro.disable();
    return true;
  }

  get gyroActive() {
    return this.gyro.active;
  }

  /** Size the stick to the screen and park it at its home position. */
  private layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // In landscape the HEIGHT is the tight dimension, so size the stick off it.
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
    for (const b of this.buttons) {
      const px = Number(b.node.dataset.base ?? 52) * this.btnScale;
      b.node.style.width = `${px}px`;
      b.node.style.height = `${px}px`;
    }
  }

  /** Layout preset: 0.8 (small) / 1 (medium) / 1.2 (large). */
  setButtonScale(mult: number) {
    this.btnScale = mult;
    this.applyButtonScale();
    this.layout();
  }

  /** Current preset, for syncing a settings selection. */
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
    // recentre on the finger: a stick that jumps to you feels far better
    // than missing it
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
    this.sink.setMove(dx / this.radius, -dy / this.radius, mag >= SPRINT_AT);
    e.preventDefault();
  }

  private dropStick(e: PointerEvent) {
    if (e.pointerId !== this.stickId) return;
    this.stickId = null;
    this.sink.setMove(0, 0, false);
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
    for (const b of this.buttons) b.pointerId = null;
    this.sink.setMove(0, 0, false);
    this.sink.setFire(false);
    this.parkStick();
  }

  dispose() {
    this.hide();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    this.root.remove();
  }
}
