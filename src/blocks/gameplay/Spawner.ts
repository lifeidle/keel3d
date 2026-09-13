/**
 * Spawner — unit table + factory. Opt-in; pure logic + callbacks.
 * Content supplies createUnit; Spawner handles bookkeeping.
 */
export interface UnitTableRow {
  hp: number;
  speed?: number;
  bounty?: number;
  color?: number;
  radius?: number;
}

export type UnitTable = Record<string, UnitTableRow>;

export interface SpawnedUnit<T = unknown> {
  key: string;
  row: UnitTableRow;
  handle: T;
  hp: number;
  alive: boolean;
}

export interface SpawnerOpts<T> {
  table: UnitTable;
  create: (key: string, row: UnitTableRow) => T;
  destroy?: (handle: T) => void;
  onDeath?: (unit: SpawnedUnit<T>, killer?: unknown) => void;
}

export class Spawner<T = unknown> {
  private table: UnitTable;
  private create: SpawnerOpts<T>['create'];
  private destroy?: SpawnerOpts<T>['destroy'];
  private onDeath?: SpawnerOpts<T>['onDeath'];
  private live: SpawnedUnit<T>[] = [];

  constructor(opts: SpawnerOpts<T>) {
    this.table = opts.table;
    this.create = opts.create;
    this.destroy = opts.destroy;
    this.onDeath = opts.onDeath;
  }

  get aliveCount(): number {
    return this.live.reduce((n, u) => n + (u.alive ? 1 : 0), 0);
  }

  get units(): readonly SpawnedUnit<T>[] {
    return this.live;
  }

  spawn(key: string): SpawnedUnit<T> | null {
    const row = this.table[key];
    if (!row) return null;
    const handle = this.create(key, row);
    const unit: SpawnedUnit<T> = { key, row, handle, hp: row.hp, alive: true };
    this.live.push(unit);
    return unit;
  }

  /** Apply damage; triggers death + onDeath. */
  damage(unit: SpawnedUnit<T>, amount: number, killer?: unknown): boolean {
    if (!unit.alive || amount <= 0) return false;
    unit.hp = Math.max(0, unit.hp - amount);
    if (unit.hp === 0) {
      unit.alive = false;
      this.onDeath?.(unit, killer);
    }
    return true;
  }

  /** Remove dead units from the list (call after frame). */
  reap(): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      if (!this.live[i].alive) {
        this.destroy?.(this.live[i].handle);
        this.live.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const u of this.live) {
      if (u.alive) u.alive = false;
      this.destroy?.(u.handle);
    }
    this.live.length = 0;
  }
}
