/**
 * RunState — per-run stats snapshot. Pure data.
 */
export class RunState {
  kills = 0;
  deaths = 0;
  time = 0;
  score = 0;
  custom = new Map<string, number>();

  tick(dt: number): void {
    this.time += dt;
  }

  addKill(n = 1): void {
    this.kills += n;
  }

  addDeath(): void {
    this.deaths++;
  }

  set(key: string, v: number): void {
    this.custom.set(key, v);
  }

  get(key: string): number {
    return this.custom.get(key) ?? 0;
  }

  snapshot(): Record<string, number> {
    const o: Record<string, number> = {
      kills: this.kills,
      deaths: this.deaths,
      time: this.time,
      score: this.score,
    };
    for (const [k, v] of this.custom) o[k] = v;
    return o;
  }

  reset(): void {
    this.kills = 0;
    this.deaths = 0;
    this.time = 0;
    this.score = 0;
    this.custom.clear();
  }
}
