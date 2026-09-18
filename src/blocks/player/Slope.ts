/**
 * Slope — pure slope-aware movement helpers (R54). Headless-testable.
 *
 * Gap: entities that ride a height field (enemy feet on yexi terrain) move
 * in XZ and snap Y — with no slope awareness they climb cliffs at flat
 * speed. These pure helpers turn a height sampler into a speed penalty so
 * content decides the soft/hard gradient thresholds.
 */

/**
 * Climb fraction of a step: (hDest − hSrc) / horizontal distance.
 * Positive = uphill, negative = downhill. 0 for zero-length steps.
 */
export function climbRatio(
  src: { x: number; z: number },
  dest: { x: number; z: number },
  h: (x: number, z: number) => number,
): number {
  const d = Math.hypot(dest.x - src.x, dest.z - src.z);
  if (d < 1e-6) return 0;
  return (h(dest.x, dest.z) - h(src.x, src.z)) / d;
}

/**
 * Speed factor (0..1) for a step at `climb` ratio. Full speed up to
 * `soft`, linear penalty down to `minFactor` at `hard`, clamped at
 * `minFactor` beyond (entities push uphill — never fully stopped).
 */
export function slopeFactor(
  climb: number,
  soft: number,
  hard: number,
  minFactor = 0.35,
): number {
  if (climb <= soft) return 1;
  if (climb >= hard) return minFactor;
  const t = (climb - soft) / (hard - soft);
  return 1 - t * (1 - minFactor);
}
