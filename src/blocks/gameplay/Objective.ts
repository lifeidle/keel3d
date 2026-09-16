/**
 * Objective — data-driven objective chain (pure logic, no three/DOM).
 *
 * A sequential objective list with progress counting: only the ACTIVE
 * objective accepts `bump`; reaching `target` auto-completes (and fires
 * `onComplete`); `target = 0` marks a flag objective completed via
 * `complete()`. Games wire game events to bump/complete and use
 * `onComplete` to chain the next step (spawn a wave, arm a timer, win).
 *
 * Display is separate: pair with `blocks/ui/QuestTracker` (pass
 * `snapshot()` items — it renders progress pairs and the active marker).
 *
 * Usage (yexi slice 4):
 *   const ob = new ObjectiveTracker();
 *   ob.add('purge', '清剿敌人', 3, true);
 *   ob.add('intel', '取回情报', 0);
 *   ob.add('holdout', '坚守', 15);
 *   ob.onComplete = (o) => {
 *     if (o.id === 'purge') { spawnWave2(); ob.activate('intel'); }
 *     if (o.id === 'intel') ob.activate('holdout');
 *     if (o.id === 'holdout') win();
 *   };
 */
export interface Objective {
  id: string;
  label: string;
  /** 0 = flag objective (complete() only); >0 = progress objective. */
  target: number;
  progress: number;
  done: boolean;
  /** Only the active objective accepts bump(). */
  active: boolean;
}

export interface ObjectiveSnapshot {
  id: string;
  label: string;
  target: number;
  progress: number;
  done: boolean;
  active: boolean;
}

export class ObjectiveTracker {
  private list: Objective[] = [];
  /** Fired once when an objective transitions to done. */
  onComplete?: (o: Objective) => void;
  /** Fired when every objective is done. */
  onAllDone?: () => void;

  /** Append an objective. `active = true` makes it the counting one. */
  add(id: string, label: string, target = 0, active = false): Objective {
    if (this.list.some((o) => o.id === id)) throw new Error('ObjectiveTracker: duplicate id ' + id);
    const o: Objective = { id, label, target: Math.max(0, target), progress: 0, done: false, active };
    this.list.push(o);
    return o;
  }

  private find(id: string): Objective {
    const o = this.list.find((x) => x.id === id);
    if (!o) throw new Error('ObjectiveTracker: unknown id ' + id);
    return o;
  }

  /**
   * Make `id` the ONLY counting objective (single-active sequence model):
   * the others are deactivated. Chain steps by activating the next one in
   * `onComplete`.
   */
  activate(id: string): void {
    for (const o of this.list) o.active = false;
    this.find(id).active = true;
  }

  /**
   * Add progress. Ignored unless active and not done (sequence gate).
   * Clamps at target and auto-completes on reaching it.
   */
  bump(id: string, n = 1): void {
    const o = this.find(id);
    if (o.done || !o.active || o.target <= 0) return;
    o.progress = Math.min(o.target, o.progress + n);
    if (o.progress >= o.target) this.markDone(o);
  }

  /** Complete a flag objective (target 0) — or force-complete any. */
  complete(id: string): void {
    const o = this.find(id);
    if (o.done) return;
    o.progress = o.target;
    this.markDone(o);
  }

  private markDone(o: Objective): void {
    o.done = true;
    o.active = false;
    this.onComplete?.(o);
    if (this.allDone()) this.onAllDone?.();
  }

  /** The first active, not-done objective (null when all done or none active). */
  current(): Objective | null {
    return this.list.find((o) => o.active && !o.done) ?? null;
  }

  allDone(): boolean {
    return this.list.length > 0 && this.list.every((o) => o.done);
  }

  /** HUD-friendly copy (display is a separate concern). */
  snapshot(): ObjectiveSnapshot[] {
    return this.list.map((o) => ({
      id: o.id,
      label: o.label,
      target: o.target,
      progress: o.progress,
      done: o.done,
      active: o.active,
    }));
  }

  /** Back to the first objective (retry / recycle). */
  reset(): void {
    for (const o of this.list) {
      o.progress = 0;
      o.done = false;
      o.active = false;
    }
    if (this.list.length) this.list[0].active = true;
  }
}
