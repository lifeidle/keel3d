/**
 * Faction — hostility matrix between team ids.
 */
export class FactionMap {
  private hostile = new Set<string>();

  private key(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  setHostile(a: string, b: string, on = true): void {
    if (a === b) return;
    const k = this.key(a, b);
    if (on) this.hostile.add(k);
    else this.hostile.delete(k);
  }

  isHostile(a: string, b: string): boolean {
    if (!a || !b || a === b) return false;
    return this.hostile.has(this.key(a, b));
  }

  /** Default: everyone vs everyone except self. */
  static allAgainstAll(ids: string[]): FactionMap {
    const m = new FactionMap();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) m.setHostile(ids[i], ids[j], true);
    }
    return m;
  }

  clear(): void {
    this.hostile.clear();
  }
}
