/**
 * LevelTable — list of levels with unlock conditions. Pure data helper.
 */
export interface LevelDef {
  id: string;
  title?: string;
  /** Unlock when previous cleared, or score threshold. */
  requires?: string;
  minScore?: number;
}

export class LevelTable {
  private levels: LevelDef[];
  private cleared = new Set<string>();

  constructor(levels: LevelDef[] = []) {
    this.levels = levels.slice();
  }

  get all(): readonly LevelDef[] {
    return this.levels;
  }

  markCleared(id: string): void {
    this.cleared.add(id);
  }

  isCleared(id: string): boolean {
    return this.cleared.has(id);
  }

  isUnlocked(def: LevelDef): boolean {
    if (def.requires && !this.cleared.has(def.requires)) return false;
    return true;
  }

  /** First unlocked uncleared level, or null. */
  nextLevel(): LevelDef | null {
    for (const l of this.levels) {
      if (!this.cleared.has(l.id) && this.isUnlocked(l)) return l;
    }
    return null;
  }

  serialize(): string[] {
    return [...this.cleared];
  }

  restore(ids: string[]): void {
    this.cleared = new Set(ids);
  }
}
