/**
 * Countdown — fixed timer HUD. Null-safe without DOM.
 */
export class Countdown {
  readonly el: HTMLElement | null;
  private remaining = 0;
  private total = 0;
  private running = false;
  private finished = false;

  constructor(opts: { id?: string; seconds?: number } = {}) {
    this.total = Math.max(0, opts.seconds ?? 60);
    this.remaining = this.total;
    if (typeof document === 'undefined') {
      this.el = null;
      return;
    }
    const el = document.createElement('div');
    if (opts.id) el.id = opts.id;
    el.style.cssText =
      'position:fixed;right:14px;top:14px;z-index:25;color:#e8eef7;' +
      'font:700 22px/1 ui-monospace,Consolas,monospace;' +
      'background:rgba(0,0,0,.45);padding:8px 12px;border-radius:8px;pointer-events:none;';
    document.body.appendChild(el);
    this.el = el;
    this.render();
  }

  start(seconds?: number): void {
    if (seconds != null) this.total = seconds;
    this.remaining = this.total;
    this.running = true;
    this.finished = false;
    this.render();
  }

  stop(): void {
    this.running = false;
  }

  get done(): boolean {
    return this.finished;
  }

  get secondsLeft(): number {
    return Math.max(0, Math.ceil(this.remaining));
  }

  update(dt: number): void {
    if (!this.running) return;
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.remaining = 0;
      this.running = false;
      this.finished = true;
    }
    this.render();
  }

  private render(): void {
    if (!this.el) return;
    const s = Math.max(0, Math.ceil(this.remaining));
    const m = Math.floor(s / 60);
    const r = s % 60;
    this.el.textContent = `${m}:${String(r).padStart(2, '0')}`;
    this.el.style.color = this.remaining <= 10 && this.running ? '#ff8a80' : '#e8eef7';
  }

  dispose(): void {
    this.el?.remove();
  }
}
