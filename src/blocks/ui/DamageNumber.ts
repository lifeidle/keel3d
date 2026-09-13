/**
 * DamageNumber — floating 2D damage text (DOM). Opt-in.
 */
export class DamageNumbers {
  private pool: HTMLElement[] = [];

  spawn(x: number, y: number, text: string, crit = false): void {
    if (typeof document === 'undefined') return;
    const el = this.pool.pop() ?? document.createElement('div');
    el.textContent = text;
    el.style.cssText =
      `position:fixed;left:${x}px;top:${y}px;z-index:30;pointer-events:none;` +
      `font:700 ${crit ? 18 : 14}px/1 system-ui,sans-serif;color:${crit ? '#ffd27a' : '#ffb0b0'};` +
      `text-shadow:0 1px 2px #000;transition:top .6s ease-out,opacity .6s;opacity:1`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = `${y - 36}px`;
      el.style.opacity = '0';
    });
    setTimeout(() => {
      el.remove();
      this.pool.push(el);
    }, 650);
  }

  /** Project world pos roughly to screen (caller can pass canvas coords). */
  spawnAtScreen(clientX: number, clientY: number, text: string, crit = false): void {
    this.spawn(clientX, clientY, text, crit);
  }

  dispose(): void {
    this.pool.length = 0;
  }
}
