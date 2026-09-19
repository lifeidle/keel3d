/**
 * ChainBlast — one blast pass that both damages AND triggers nearby
 * chainable items (R60). Pure, headless-testable.
 *
 * Gap: chain explosions (barrel → barrel) hand-roll TWO distance passes
 * per recipe: a blast-damage loop + a second loop arming neighbor fuses.
 * This block unifies them into one deterministic pass. Damage follows
 * Blast semantics (linear falloff); the trigger pass is ref-based —
 * the block knows nothing about Fuse, callers arm whatever they want
 * for each triggered ref.
 */
import { blastHits, type BlastHit, type BlastTarget } from './Blast';

export interface ChainItem extends BlastTarget {
  /**
   * Opaque "chainable" handle. Items with `fuseRef === undefined` can be
   * damaged but never trigger (players, enemies).
   */
  fuseRef?: unknown;
}

export interface ChainResult {
  /** Per-target damage (Blast semantics; out-of-range reported with 0). */
  hits: BlastHit[];
  /** Items triggered (fuseRef set, not excluded, within trigger radius). */
  triggered: ChainItem[];
}

export interface ChainOpts {
  /** Exclude from BOTH passes (e.g. the blast source). */
  exclude?: (t: ChainItem) => boolean;
  /**
   * Exclude from the DAMAGE pass only — "trigger-only" items (e.g. barrels
   * that chain but take no blast damage). They still trigger.
   */
  damageExclude?: (t: ChainItem) => boolean;
  /** Trigger radius (defaults to the damage radius). */
  triggerRadius?: number;
  /** Extra trigger exclusion (e.g. already-exploded items). */
  triggerExclude?: (t: ChainItem) => boolean;
}

/**
 * One unified blast: damage (Blast falloff) + trigger (proximity).
 * Triggered items are returned in input order; `hits` covers all items
 * (alive, non-excluded) like blastHits does.
 */
export function chainBlast(
  cx: number,
  cz: number,
  radius: number,
  damage: number,
  falloff: number,
  items: ChainItem[],
  opts: ChainOpts = {},
): ChainResult {
  const hits = blastHits(
    cx,
    cz,
    items,
    { radius, damage, falloff },
    (t) =>
      (opts.exclude?.(t) ?? false) || (opts.damageExclude?.(t) ?? false),
  );

  const triggerRadius = opts.triggerRadius ?? radius;
  const triggered: ChainItem[] = [];
  for (const t of items) {
    if (t.fuseRef === undefined) continue;
    if (t.alive === false) continue;
    if (opts.exclude && opts.exclude(t)) continue;
    if (opts.triggerExclude && opts.triggerExclude(t)) continue;
    const d = Math.hypot(t.x - cx, t.z - cz);
    if (d <= triggerRadius) triggered.push(t);
  }
  return { hits, triggered };
}
