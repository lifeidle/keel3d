/**
 * EndOverlay — win/lose fullscreen message. Opt-in.
 */
export class EndOverlay {
  private el: HTMLElement | null = null;

  show(title: string, win: boolean): void {
    if (typeof document === 'undefined') return;
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.style.cssText =
        'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;' +
        'background:rgba(0,0,0,.55);color:#fff;font:28px/1.4 system-ui,sans-serif;pointer-events:none;';
      document.body.appendChild(this.el);
    }
    this.el.textContent = title;
    this.el.style.color = win ? '#5dcea0' : '#e07070';
    this.el.style.display = 'flex';
  }

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  }

  dispose(): void {
    this.el?.remove();
    this.el = null;
  }
}
