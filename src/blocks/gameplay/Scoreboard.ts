/**
 * Scoreboard — simple counters for HUD / win conditions. Opt-in.
 */
export class Scoreboard {
  kills = 0;
  wave = 0;
  time = 0;
  custom = new Map<string, number>();

  addKill(n = 1): void {
    this.kills += n;
  }

  tick(dt: number): void {
    this.time += dt;
  }

  set(key: string, value: number): void {
    this.custom.set(key, value);
  }

  get(key: string): number {
    return this.custom.get(key) ?? 0;
  }

  add(key: string, n = 1): number {
    const v = (this.custom.get(key) ?? 0) + n;
    this.custom.set(key, v);
    return v;
  }

  snapshot(): Record<string, number> {
    const o: Record<string, number> = { kills: this.kills, wave: this.wave, time: this.time };
    for (const [k, v] of this.custom) o[k] = v;
    return o;
  }

  reset(): void {
    this.kills = 0;
    this.wave = 0;
    this.time = 0;
    this.custom.clear();
  }
}
