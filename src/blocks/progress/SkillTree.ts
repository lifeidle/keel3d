/**
 * SkillTree — unlock nodes with costs and prerequisites. Pure logic.
 */
export interface SkillNode {
  id: string;
  cost: number;
  requires?: string[];
}

export class SkillTree {
  private nodes = new Map<string, SkillNode>();
  private unlocked = new Set<string>();
  private _points = 0;
  onChange?: () => void;

  constructor(nodes: SkillNode[] = [], startPoints = 0) {
    for (const n of nodes) this.nodes.set(n.id, n);
    this._points = startPoints;
  }

  get points(): number {
    return this._points;
  }

  isUnlocked(id: string): boolean {
    return this.unlocked.has(id);
  }

  canUnlock(id: string): boolean {
    const n = this.nodes.get(id);
    if (!n || this.unlocked.has(id)) return false;
    if (this._points < n.cost) return false;
    for (const r of n.requires ?? []) {
      if (!this.unlocked.has(r)) return false;
    }
    return true;
  }

  unlock(id: string): boolean {
    if (!this.canUnlock(id)) return false;
    const n = this.nodes.get(id)!;
    this._points -= n.cost;
    this.unlocked.add(id);
    this.onChange?.();
    return true;
  }

  addPoints(n: number): void {
    this._points += Math.max(0, n);
  }

  serialize(): string[] {
    return [...this.unlocked];
  }

  restore(ids: string[]): void {
    this.unlocked = new Set(ids);
  }
}
