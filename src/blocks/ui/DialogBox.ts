/**
 * DialogBox — DOM overlay for Dialogue. Null-safe without document.
 */
import type { Dialogue } from '../gameplay/Dialogue';

export class DialogBox {
  readonly el: HTMLElement | null;
  private dlg: Dialogue;
  private textEl: HTMLElement | null = null;
  private optsEl: HTMLElement | null = null;

  constructor(dlg: Dialogue, opts: { id?: string; parent?: HTMLElement } = {}) {
    this.dlg = dlg;
    if (typeof document === 'undefined') {
      this.el = null;
      return;
    }
    const root = document.createElement('div');
    if (opts.id) root.id = opts.id;
    root.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:40;' +
      'width:min(560px,90vw);background:rgba(10,16,28,.92);border:1px solid #3a4a66;' +
      'border-radius:10px;padding:14px 16px;color:#e8eef7;font:14px/1.5 system-ui;display:none;';
    this.textEl = document.createElement('div');
    this.textEl.style.cssText = 'margin-bottom:10px;min-height:2.5em;';
    this.optsEl = document.createElement('div');
    this.optsEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
    root.appendChild(this.textEl);
    root.appendChild(this.optsEl);
    (opts.parent ?? document.body).appendChild(root);
    this.el = root;
    dlg.onChange = () => this.sync();
    root.onclick = () => {
      if (this.dlg.options().length === 0) this.dlg.advance();
    };
  }

  private sync(): void {
    if (!this.el || !this.textEl || !this.optsEl) return;
    const st = this.dlg.current;
    if (st.ended) {
      this.el.style.display = 'none';
      return;
    }
    this.el.style.display = 'block';
    this.textEl.textContent = this.dlg.line() ?? '';
    this.optsEl.innerHTML = '';
    const opts = this.dlg.options();
    opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.textContent = o.text;
      b.style.cssText =
        'background:#1a283f;color:#e8eef7;border:1px solid #6ec8ff;border-radius:6px;' +
        'padding:6px 12px;cursor:pointer;font:13px system-ui;';
      b.onclick = (e) => {
        e.stopPropagation();
        this.dlg.choose(i);
      };
      this.optsEl!.appendChild(b);
    });
  }

  dispose(): void {
    this.dlg.onChange = undefined;
    this.el?.remove();
  }
}
