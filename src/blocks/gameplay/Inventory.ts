/**
 * Inventory — slot bag + equipment slots. Pure data; optional onChange.
 */
export interface InvItem {
  id: string;
  qty: number;
  meta?: Record<string, unknown>;
}

export type EquipSlot = 'weapon' | 'armor' | 'trinket';

export interface InventoryOpts {
  slots: number;
  stackLimit?: number;
}

export class Inventory {
  private _slots: (InvItem | null)[];
  private stackLimit: number;
  private _equipped: Record<EquipSlot, InvItem | null> = {
    weapon: null,
    armor: null,
    trinket: null,
  };
  onChange?: () => void;

  constructor(opts: InventoryOpts) {
    const n = Math.max(1, Math.floor(opts.slots));
    this._slots = new Array(n).fill(null);
    this.stackLimit = Math.max(1, opts.stackLimit ?? 99);
  }

  get length(): number {
    return this._slots.length;
  }

  get slots(): readonly (InvItem | null)[] {
    return this._slots;
  }

  get equipped(): Readonly<Record<EquipSlot, InvItem | null>> {
    return this._equipped;
  }

  count(id: string): number {
    let n = 0;
    for (const s of this._slots) if (s && s.id === id) n += s.qty;
    return n;
  }

  /** Returns leftover qty that did not fit. */
  add(item: InvItem): number {
    let left = Math.max(0, Math.floor(item.qty));
    if (left === 0) return 0;
    // stack into existing
    for (const s of this._slots) {
      if (!s || s.id !== item.id || s.qty >= this.stackLimit) continue;
      const room = this.stackLimit - s.qty;
      const take = Math.min(room, left);
      s.qty += take;
      left -= take;
      if (left <= 0) break;
    }
    // new slots
    for (let i = 0; i < this._slots.length && left > 0; i++) {
      if (this._slots[i]) continue;
      const take = Math.min(this.stackLimit, left);
      this._slots[i] = { id: item.id, qty: take, meta: item.meta };
      left -= take;
    }
    this.onChange?.();
    return left;
  }

  remove(id: string, qty: number): boolean {
    let need = Math.max(0, Math.floor(qty));
    if (need === 0) return true;
    if (this.count(id) < need) return false;
    for (let i = this._slots.length - 1; i >= 0 && need > 0; i--) {
      const s = this._slots[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.qty, need);
      s.qty -= take;
      need -= take;
      if (s.qty <= 0) this._slots[i] = null;
    }
    this.onChange?.();
    return true;
  }

  equip(slot: EquipSlot, item: InvItem | null): boolean {
    if (!item) {
      this._equipped[slot] = null;
      this.onChange?.();
      return true;
    }
    // require at least one in bag
    if (this.count(item.id) < 1) return false;
    this._equipped[slot] = { ...item, qty: 1 };
    this.onChange?.();
    return true;
  }

  serialize(): string {
    return JSON.stringify({ slots: this._slots, eq: this._equipped });
  }

  restore(json: string): void {
    try {
      const o = JSON.parse(json) as { slots: (InvItem | null)[]; eq: Record<EquipSlot, InvItem | null> };
      if (Array.isArray(o.slots)) {
        this._slots = o.slots.slice(0, this._slots.length);
        while (this._slots.length < this._slots.length) this._slots.push(null);
        // pad if short
        const n = this._slots.length;
        this._slots.length = n;
      }
      if (o.eq) this._equipped = { ...this._equipped, ...o.eq };
      this.onChange?.();
    } catch {
      /* ignore bad json */
    }
  }

  reset(): void {
    this._slots.fill(null);
    this._equipped = { weapon: null, armor: null, trinket: null };
    this.onChange?.();
  }
}
