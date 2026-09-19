/**
 * QuestTracker — simple objective list (DOM). Opt-in.
 */
export interface QuestItem {
  id: string;
  title: string;
  done?: boolean;
  /** [current, target] — rendered as "title 2/3" while not done. */
  progress?: readonly [number, number];
  /**
   * Timer objectives: render the REMAINING amount as "title 11s" instead of
   * "title 4/15" (holdout countdowns — what matters is time left).
   */
  countdown?: boolean;
  /** Highlight as the current objective (▶ marker). */
  active?: boolean;
}

/**
 * Format one quest line (pure — headless-testable).
 * "☑/▶/☐ title [n/m]" or, with `countdown`, "… title Xs" (time left).
 */
export function questLine(item: QuestItem): string {
  const mark = item.done ? '☑' : item.active ? '▶' : '☐';
  let prog = '';
  if (!item.done && item.progress) {
    prog = item.countdown
      ? ` ${Math.max(0, item.progress[1] - item.progress[0])}s`
      : ` ${item.progress[0]}/${item.progress[1]}`;
  }
  return `${mark} ${item.title}${prog}`;
}

export class QuestTracker {
  readonly el: HTMLElement | null;
  private items: QuestItem[] = [];

  constructor(opts: { title?: string } = {}) {
    if (typeof document === 'undefined') {
      this.el = null;
      return;
    }
    const el = document.createElement('div');
    el.id = 'quest-tracker';
    el.style.cssText =
      'position:fixed;right:12px;top:12px;z-index:20;color:#e8eef7;font:13px/1.45 system-ui,sans-serif;' +
      'background:rgba(0,0,0,.5);padding:10px 12px;border-radius:8px;pointer-events:none;min-width:140px;white-space:pre';
    el.textContent = opts.title ?? '任务';
    document.body.appendChild(el);
    this.el = el;
  }

  setItems(items: readonly QuestItem[]): void {
    this.items = items.map((i) => ({ ...i }));
    this.render();
  }

  complete(id: string): void {
    const q = this.items.find((i) => i.id === id);
    if (q) {
      q.done = true;
      this.render();
    }
  }

  private render(): void {
    if (!this.el) return;
    const lines = this.items.map((i) => questLine(i));
    this.el.textContent = lines.length ? lines.join('\n') : '（无任务）';
  }

  dispose(): void {
    this.el?.remove();
  }
}
