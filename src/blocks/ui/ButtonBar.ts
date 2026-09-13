/**
 * ButtonBar — fixed bottom skill/action bar (DOM). Opt-in.
 */
export interface ButtonSlot {
  id: string;
  label: string;
  key?: string;
  disabled?: boolean;
}

export class ButtonBar {
  readonly el: HTMLElement | null;
  private buttons = new Map<string, HTMLElement>();
  private onClick: (id: string) => void;

  constructor(opts: { onClick?: (id: string) => void } = {}) {
    this.onClick = opts.onClick ?? (() => {});
    if (typeof document === 'undefined') {
      this.el = null;
      return;
    }
    const el = document.createElement('div');
    el.id = 'button-bar';
    el.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:22;display:flex;gap:8px;pointer-events:auto';
    document.body.appendChild(el);
    this.el = el;
  }

  setSlots(slots: readonly ButtonSlot[]): void {
    if (!this.el) return;
    this.el.innerHTML = '';
    this.buttons.clear();
    for (const s of slots) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.key ? `${s.label} [${s.key}]` : s.label;
      b.disabled = !!s.disabled;
      b.style.cssText =
        'min-width:72px;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.2);' +
        'background:rgba(0,0,0,.55);color:#e8eef7;font:13px system-ui,sans-serif;cursor:pointer';
      b.addEventListener('click', () => this.onClick(s.id));
      this.el.appendChild(b);
      this.buttons.set(s.id, b);
    }
  }

  setActive(id: string): void {
    for (const [k, el] of this.buttons) {
      el.style.outline = k === id ? '2px solid #6ec8ff' : 'none';
    }
  }

  setDisabled(id: string, on: boolean): void {
    const el = this.buttons.get(id);
    if (el) (el as HTMLButtonElement).disabled = on;
  }

  dispose(): void {
    this.el?.remove();
  }
}
