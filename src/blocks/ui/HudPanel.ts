/**
 * HudPanel — fixed-corner DOM panel. Opt-in; creates element on construct.
 */
export interface HudPanelOpts {
  id?: string;
  position?: 'tl' | 'tr' | 'bl' | 'br';
  html?: string;
  hidden?: boolean;
}

const POS: Record<string, string> = {
  tl: 'left:12px;top:12px',
  tr: 'right:12px;top:12px',
  bl: 'left:12px;bottom:12px',
  br: 'right:12px;bottom:12px',
};

export class HudPanel {
  readonly el: HTMLElement | null;

  constructor(opts: HudPanelOpts = {}) {
    if (typeof document === 'undefined') {
      this.el = null;
      return;
    }
    const el = document.createElement('div');
    if (opts.id) el.id = opts.id;
    el.style.cssText =
      `position:fixed;z-index:20;color:#e8eef7;font:14px/1.45 ui-monospace,Consolas,monospace;` +
      `background:rgba(0,0,0,.5);padding:10px 12px;border-radius:8px;pointer-events:none;white-space:pre;` +
      `${POS[opts.position ?? 'tl'] ?? POS.tl}`;
    if (opts.hidden) el.style.display = 'none';
    el.textContent = opts.html ?? '';
    document.body.appendChild(el);
    this.el = el;
  }

  setText(text: string): void {
    if (this.el) this.el.textContent = text;
  }

  setHtml(html: string): void {
    if (this.el) this.el.innerHTML = html;
  }

  show(): void {
    if (this.el) this.el.style.display = '';
  }

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  }

  dispose(): void {
    this.el?.remove();
  }
}
