/**
 * Toast — short-lived bottom message. Opt-in.
 */
export class Toast {
  private el: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(msg: string, ms = 1800): void {
    if (typeof document === 'undefined') return;
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.style.cssText =
        'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:40;' +
        'background:#1a283f;border:1px solid #6ec8ff;color:#e8eef7;padding:10px 18px;' +
        'border-radius:999px;font:13px/1.4 system-ui,sans-serif;pointer-events:none;';
      document.body.appendChild(this.el);
    }
    this.el.textContent = msg;
    this.el.style.opacity = '1';
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.el) this.el.style.opacity = '0';
    }, ms);
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.el?.remove();
    this.el = null;
  }
}
