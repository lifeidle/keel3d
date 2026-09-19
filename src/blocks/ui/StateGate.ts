/**
 * StateGate — conditional element visibility (R82).
 *
 * Gap: content hand-rolls "el.style.opacity = cond ? '1' : '0'" in
 * repeated places (yexi: reload bar R75, low-ammo chip R76, tank bar
 * R82). This block owns the pattern: a per-element visible state with
 * configurable on/off values and a testable style property. The core
 * (`gateStyle`) is pure — headless-testable.
 */
export interface StateGateOpts {
  /** Style value when active. Default '1'. */
  on?: string;
  /** Style value when inactive. Default '0'. */
  off?: string;
  /** Style property to drive. Default 'opacity'. */
  prop?: 'opacity' | 'display' | 'visibility';
}

/**
 * Pure: the style value a gate applies for a visible state.
 * Headless-testable.
 */
export function gateStyle(active: boolean, opts: StateGateOpts = {}): string {
  return active ? (opts.on ?? '1') : (opts.off ?? '0');
}

/**
 * Gated element visibility. Construct with the element (or null in
 * headless); `set()` applies the visible state to `el.style[prop]`.
 */
export class StateGate {
  private el: HTMLElement | null;
  private opts: StateGateOpts;
  private active = false;

  constructor(el: HTMLElement | null, opts: StateGateOpts = {}) {
    this.el = el;
    this.opts = opts;
    if (el) el.style[this.opts.prop ?? 'opacity'] = gateStyle(false, this.opts);
  }

  /** Apply the visible state (drives the element style when a DOM exists). */
  set(active: boolean): void {
    this.active = active;
    if (this.el) {
      this.el.style[this.opts.prop ?? 'opacity'] = gateStyle(active, this.opts);
    }
  }

  get visible(): boolean {
    return this.active;
  }

  dispose(): void {
    this.el = null;
  }
}
