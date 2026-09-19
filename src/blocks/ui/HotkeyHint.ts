/**
 * HotkeyHint — contextual hotkey hints (DOM). Opt-in.
 *
 * Content pushes candidate hints each frame ({key, label, active,
 * priority?}); the panel shows the ACTIVE ones (priority descending,
 * capped) — classic "E 上车 / F 拾取" discoverability prompts. The
 * selection is a pure function (`pickHints`) — headless-testable.
 */
export interface HotkeyHint {
  /** Display key ('E', 'F', 'T'…). */
  key: string;
  /** Action label ('上车' / '补弹'). */
  label: string;
  /** Higher wins when multiple hints are active. Default 0. */
  priority?: number;
  /** Only active hints are shown. */
  active: boolean;
}

/**
 * Pure selection: active hints, priority descending (stable for equal
 * priority), capped at `max`. Headless-testable.
 */
export function pickHints(hints: readonly HotkeyHint[], max = 2): HotkeyHint[] {
  return hints
    .filter((h) => h.active)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, max);
}

export interface HotkeyHintPanelOpts {
  /** Max hints shown. Default 2. */
  max?: number;
  /** CSS for the element (positioning). */
  css?: string;
  /** Append to document.body when created (default true). */
  autoAppend?: boolean;
}

export class HotkeyHintPanel {
  readonly el: HTMLElement | null;
  private hints: HotkeyHint[] = [];
  private max: number;

  constructor(opts: HotkeyHintPanelOpts = {}) {
    this.max = opts.max ?? 2;
    this.el = null;
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.id = 'hotkey-hints';
    el.style.cssText =
      opts.css ??
      'position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:20;' +
        'color:#ffd27a;font:13px system-ui,sans-serif;pointer-events:none;text-align:center;' +
        'text-shadow:0 1px 2px rgba(0,0,0,.8);display:none';
    if (opts.autoAppend ?? true) document.body.appendChild(el);
    this.el = el;
  }

  /** Content pushes the candidate set (replaces the previous). */
  set(hints: readonly HotkeyHint[]): void {
    this.hints = hints.map((h) => ({ ...h }));
    this.render();
  }

  /** The hints currently shown (see pickHints). */
  visible(): readonly HotkeyHint[] {
    return pickHints(this.hints, this.max);
  }

  private render(): void {
    if (!this.el) return;
    const v = this.visible();
    this.el.textContent = v.map((h) => `${h.key} ${h.label}`).join('  ·  ');
    this.el.style.display = v.length ? 'block' : 'none';
  }

  dispose(): void {
    this.el?.remove();
  }
}
