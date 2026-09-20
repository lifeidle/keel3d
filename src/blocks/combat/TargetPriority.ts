/**
 * TargetPriority — candidate + score → selection (R97). Pure.
 *
 * Gap: "which target do I shoot at" appears in every shooter/enemy —
 * nearest-alive (pickTarget), nearest-point-within-radius (nearestPoint),
 * ad-hoc "player unless they're inside a tank" rules. Content
 * reimplements the priority logic per system. One testable form:
 * candidates each carry a score; LOWEST wins, ties → earlier index,
 * Infinity-score candidates are ineligible (dead/out-of-range markers).
 */
export interface TargetCandidate<T> {
  /** The target this candidate points at. */
  ref: T;
  /** Lower is better. Use Infinity to mark an ineligible candidate. */
  score: number;
}

/**
 * The lowest-scoring candidate's ref, or null when the list is empty or
 * every candidate is ineligible (Infinity/NaN). Strict `<` keeps the
 * earliest index on exact ties.
 */
export function pickBest<T>(candidates: readonly TargetCandidate<T>[]): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const s = c.score;
    if (!Number.isFinite(s)) continue; // ineligible (dead / out of range)
    if (s < bestScore) {
      bestScore = s;
      best = c.ref;
    }
  }
  return best;
}
