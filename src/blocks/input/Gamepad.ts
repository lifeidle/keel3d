/**
 * Gamepad — standard-mapped poll each frame. Silent zeros when disconnected.
 */
export type GamepadButton = 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt' | 'start' | 'select';

const BTN_INDEX: Record<GamepadButton, number> = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
};

const DEADZONE = 0.15;

function dz(v: number): number {
  const a = Math.abs(v);
  if (a < DEADZONE) return 0;
  const s = Math.sign(v);
  return (s * (a - DEADZONE)) / (1 - DEADZONE);
}

export class Gamepad {
  private pad: globalThis.Gamepad | null = null;
  private _moveX = 0;
  private _moveY = 0;
  private _lookX = 0;
  private _lookY = 0;
  private _fire = false;
  private _alt = false;
  private _btn: Record<GamepadButton, boolean> = {
    a: false, b: false, x: false, y: false,
    lb: false, rb: false, lt: false, rt: false,
    start: false, select: false,
  };

  get connected(): boolean {
    return !!this.pad;
  }

  get moveX(): number {
    return this._moveX;
  }
  get moveY(): number {
    return this._moveY;
  }
  get lookX(): number {
    return this._lookX;
  }
  get lookY(): number {
    return this._lookY;
  }
  get fire(): boolean {
    return this._fire;
  }
  get altFire(): boolean {
    return this._alt;
  }

  btn(id: GamepadButton): boolean {
    return this._btn[id];
  }

  poll(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      this.pad = null;
      this.zero();
      return;
    }
    const pads = navigator.getGamepads();
    this.pad = null;
    for (const p of pads) {
      if (p && p.connected) {
        this.pad = p;
        break;
      }
    }
    if (!this.pad) {
      this.zero();
      return;
    }
    const g: globalThis.Gamepad = this.pad;
    this._moveX = dz(g.axes[0] ?? 0);
    this._moveY = dz(g.axes[1] ?? 0);
    this._lookX = dz(g.axes[2] ?? 0);
    this._lookY = dz(g.axes[3] ?? 0);
    for (const key of Object.keys(BTN_INDEX) as GamepadButton[]) {
      const b = g.buttons[BTN_INDEX[key]];
      this._btn[key] = !!(b && b.pressed);
    }
    this._fire = this._btn.rt || this._btn.rb || this._btn.a;
    this._alt = this._btn.lt || this._btn.lb;
  }

  private zero(): void {
    this._moveX = this._moveY = this._lookX = this._lookY = 0;
    this._fire = this._alt = false;
    for (const k of Object.keys(this._btn) as GamepadButton[]) this._btn[k] = false;
  }
}
