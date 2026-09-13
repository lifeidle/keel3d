/**
 * BuildCatalog + upgrade — data-driven buildings. Pure logic.
 */
export interface BuildingDef {
  key: string;
  name?: string;
  cost: number;
  /** HP or production id, etc. */
  hp?: number;
  /** Resource per cycle. */
  produce?: number;
  produceEvery?: number;
  /** Upgrade path: next key + extra cost. */
  upgradeTo?: string;
  upgradeCost?: number;
  color?: number;
}

export type BuildCatalog = Record<string, BuildingDef>;

export interface PlacedBuilding {
  key: string;
  def: BuildingDef;
  ix: number;
  iz: number;
  hp: number;
  level: number;
  produceT: number;
}

export class BuildSystem {
  private catalog: BuildCatalog;
  private placed: PlacedBuilding[] = [];
  private canPay: (cost: number) => boolean;
  private pay: (cost: number) => void;
  private onPlace?: (b: PlacedBuilding) => void;
  private onUpgrade?: (b: PlacedBuilding) => void;

  constructor(opts: {
    catalog: BuildCatalog;
    canPay: (cost: number) => boolean;
    pay: (cost: number) => void;
    onPlace?: (b: PlacedBuilding) => void;
    onUpgrade?: (b: PlacedBuilding) => void;
  }) {
    this.catalog = opts.catalog;
    this.canPay = opts.canPay;
    this.pay = opts.pay;
    this.onPlace = opts.onPlace;
    this.onUpgrade = opts.onUpgrade;
  }

  get buildings(): readonly PlacedBuilding[] {
    return this.placed;
  }

  def(key: string): BuildingDef | undefined {
    return this.catalog[key];
  }

  place(key: string, ix: number, iz: number): PlacedBuilding | null {
    const def = this.catalog[key];
    if (!def) return null;
    if (this.placed.some((b) => b.ix === ix && b.iz === iz)) return null;
    if (!this.canPay(def.cost)) return null;
    this.pay(def.cost);
    const b: PlacedBuilding = {
      key,
      def,
      ix,
      iz,
      hp: def.hp ?? 100,
      level: 1,
      produceT: 0,
    };
    this.placed.push(b);
    this.onPlace?.(b);
    return b;
  }

  at(ix: number, iz: number): PlacedBuilding | null {
    return this.placed.find((b) => b.ix === ix && b.iz === iz) ?? null;
  }

  upgrade(ix: number, iz: number): PlacedBuilding | null {
    const b = this.at(ix, iz);
    if (!b || !b.def.upgradeTo) return null;
    const next = this.catalog[b.def.upgradeTo];
    if (!next) return null;
    const cost = b.def.upgradeCost ?? next.cost;
    if (!this.canPay(cost)) return null;
    this.pay(cost);
    b.key = next.key;
    b.def = next;
    b.level++;
    b.hp = next.hp ?? b.hp;
    this.onUpgrade?.(b);
    return b;
  }

  /** Tick production; returns total resource produced this tick. */
  update(dt: number): number {
    let made = 0;
    for (const b of this.placed) {
      if (!b.def.produce || !b.def.produceEvery) continue;
      b.produceT += dt;
      while (b.produceT >= b.def.produceEvery) {
        b.produceT -= b.def.produceEvery;
        made += b.def.produce;
      }
    }
    return made;
  }

  clear(): void {
    this.placed.length = 0;
  }
}
