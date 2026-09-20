/**
 * DropTable — entity → loot rolls (R100). Pure.
 *
 * Gap: "what does a destroyed unit drop" — drop lists, per-entry chance,
 * quantity — is hand-rolled `Math.random` + lookups per content system,
 * and impossible to test deterministically. One pure form: a table of
 * loot entries each with a drop CHANCE and an amount range; a roll
 * evaluates every entry independently (a destroyed tank can drop both
 * ammo AND a medkit); the RNG is INJECTED so tests are deterministic.
 */
export interface DropEntry {
  /** Loot id (content-defined, e.g. 'ammo' | 'med' | 'mag'). */
  id: string;
  /** Drop probability per roll, in [0, 1]. */
  chance: number;
  /** Min/max amount on a hit (inclusive-ish: amount = min + floor(rng·(max−min+1))). */
  min: number;
  max: number;
}

export interface DropResult {
  id: string;
  amount: number;
}

/**
 * Roll every entry of the table with the injected rng (called once per
 * entry: first for the chance check, second for the amount when it
 * drops — the caller's rng sequence therefore depends on earlier
 * entries' outcomes; use a stateful rng and accept that).
 *
 * An entry drops when `rng() < chance`. Amount =
 * `min + floor(rng() · (max − min + 1))` (uniform over min..max;
 * min === max → exactly min).
 *
 * Validation: every entry must have finite values, chance in [0, 1],
 * min ≤ max, integer bounds.
 */
export function rollDrops(
  table: readonly DropEntry[],
  rng: () => number = Math.random,
): DropResult[] {
  for (const e of table) {
    if (typeof e.id !== 'string' || e.id.length === 0) {
      throw new Error('rollDrops: entry id must be a non-empty string');
    }
    if (!Number.isFinite(e.chance) || e.chance < 0 || e.chance > 1) {
      throw new Error('rollDrops: chance must be finite in [0, 1]');
    }
    if (!Number.isInteger(e.min) || !Number.isInteger(e.max) || e.min < 0 || e.min > e.max) {
      throw new Error('rollDrops: min/max must be non-negative integers with min <= max');
    }
  }
  const out: DropResult[] = [];
  for (const e of table) {
    if (e.chance === 0) continue;
    const r = rng();
    if (r >= e.chance) continue;
    const spread = e.max - e.min + 1;
    out.push({ id: e.id, amount: e.min + Math.floor(rng() * spread) });
  }
  return out;
}
