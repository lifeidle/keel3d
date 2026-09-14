/**
 * BossBar — fixed top-center boss HP strip. Null-safe without DOM.
 */
export class BossBar {
  readonly el: HTMLElement | null;
  private fill: HTMLElement | null;
  private label: HTMLElement | null;

  constructor(opts: { id?: string; width?: number } = {}) {
    if (typeof document === 'undefined') {
      this.el = null;
      this.fill = null;
      this.label = null;
      return;
    }
    const w = opts.width ?? 280;
    const root = document.createElement('div');
    if (opts.id) root.id = opts.id;
    root.style.cssText =
      `position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:25;` +
      `width:${w}px;pointer-events:none;display:none;`;
    const label = document.createElement('div');
    label.style.cssText =
      'color:#f0e6d2;font:600 12px system-ui,sans-serif;text-align:center;margin-bottom:4px;' +
      'text-shadow:0 1px 2px #000;';
    label.textContent = 'BOSS';
    const track = document.createElement('div');
    track.style.cssText =
      'height:10px;background:rgba(0,0,0,.55);border:1px solid #5a2030;border-radius:5px;overflow:hidden;';
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:100%;background:linear-gradient(90deg,#c0392b,#e74c3c);';
    track.appendChild(fill);
    root.appendChild(label);
    root.appendChild(track);
    document.body.appendChild(root);
    this.el = root;
    this.fill = fill;
    this.label = label;
  }

  show(name = 'BOSS'): void {
    if (this.label) this.label.textContent = name;
    if (this.el) this.el.style.display = 'block';
  }

  hide(): void {
    if (this.el) this.el.style.display = 'none';
  }

  setHp(hp: number, max: number): void {
    if (!this.fill) return;
    const r = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
    this.fill.style.width = `${r * 100}%`;
  }

  dispose(): void {
    this.el?.remove();
  }
}
