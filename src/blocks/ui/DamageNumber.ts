/**
 * DamageNumber — floating 2D damage text (DOM). Opt-in.
 *
 * R71: style is data (`resolveDmgStyle` — pure, headless-testable) and the
 * caller may override size/color/rise/duration via `opts` (combo display,
 * pickup text, …). Without opts the defaults match the original behaviour
 * (crit = 18px gold, normal = 14px red, 36px rise, 650ms).
 */
export interface DmgStyle {
  size?: number;
  color?: string;
  /** Rise distance (px) during the fade. */
  rise?: number;
  /** Lifetime (ms) before the element is recycled. */
  ms?: number;
}

export interface ResolvedDmgStyle {
  size: number;
  color: string;
  rise: number;
  ms: number;
}

/** Pure style resolution — headless-testable (no DOM). */
export function resolveDmgStyle(crit: boolean, opts?: DmgStyle): ResolvedDmgStyle {
  return {
    size: opts?.size ?? (crit ? 18 : 14),
    color: opts?.color ?? (crit ? '#ffd27a' : '#ffb0b0'),
    rise: opts?.rise ?? 36,
    ms: opts?.ms ?? 650,
  };
}

export class DamageNumbers {
  private pool: HTMLElement[] = [];

  spawn(x: number, y: number, text: string, crit = false, opts?: DmgStyle): void {
    if (typeof document === 'undefined') return;
    const st = resolveDmgStyle(crit, opts);
    const el = this.pool.pop() ?? document.createElement('div');
    el.textContent = text;
    el.style.cssText =
      `position:fixed;left:${x}px;top:${y}px;z-index:30;pointer-events:none;` +
      `font:700 ${st.size}px/1 system-ui,sans-serif;color:${st.color};` +
      `text-shadow:0 1px 2px #000;transition:top .6s ease-out,opacity .6s;opacity:1`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.top = `${y - st.rise}px`;
      el.style.opacity = '0';
    });
    setTimeout(() => {
      el.remove();
      this.pool.push(el);
    }, st.ms);
  }

  /** Project world pos roughly to screen (caller can pass canvas coords). */
  spawnAtScreen(clientX: number, clientY: number, text: string, crit = false): void {
    this.spawn(clientX, clientY, text, crit);
  }

  dispose(): void {
    this.pool.length = 0;
  }
}
