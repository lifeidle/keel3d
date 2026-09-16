/**
 * AudioDuck — adaptive gain math for combat soundscapes. Pure, headless.
 *
 * Two problems it solves for recipes:
 * 1. Distance attenuation — the "softer when far" curve, as one reusable
 *    function instead of hand-rolled inline formulas per call site.
 * 2. Density ducking — when many events overlap (3 enemies firing + a
 *    barrel blast), per-event gain drops so the mix stays readable instead
 *    of mud. Recipes track their own active-event count (e.g. a rolling
 *    time window) and pass it in; the math here stays stateless.
 */

export interface AudioDuckCfg {
  /** Max simultaneous events before ducking kicks in. */
  maxEvents: number;
  /** Base multiplier when over the limit (decays further with count). */
  duckMul: number;
  /** Floor for the duck factor (never fully silent). */
  duckFloor: number;
  /** At this distance (or closer) gain is full. */
  minDist: number;
  /** At this distance (or farther) gain is the floor. */
  maxDist: number;
  /** Floor for distance gain (distant events never vanish). */
  minGain: number;
}

export const DEFAULT_AUDIO_DUCK: AudioDuckCfg = {
  maxEvents: 4,
  duckMul: 0.55,
  duckFloor: 0.3,
  minDist: 4,
  maxDist: 40,
  minGain: 0.08,
};

/**
 * Density duck factor: 1.0 while `active <= maxEvents`, then
 * `duckMul * maxEvents / active` — more events, quieter per-event, clamped
 * at `duckFloor` so nothing disappears.
 */
export function duckGain(
  active: number,
  cfg: AudioDuckCfg = DEFAULT_AUDIO_DUCK,
): number {
  if (active <= cfg.maxEvents) return 1;
  const g = (cfg.duckMul * cfg.maxEvents) / Math.max(1, active);
  return Math.max(cfg.duckFloor, g);
}

/**
 * Linear inverse-distance gain: 1 at/inside `minDist`, `minGain` at/beyond
 * `maxDist`, linear in between. Never below `minGain` (a distant shot still
 * tells you "something fired that way").
 */
export function distanceGain(
  dist: number,
  cfg: AudioDuckCfg = DEFAULT_AUDIO_DUCK,
): number {
  const { minDist, maxDist, minGain } = cfg;
  if (dist <= minDist) return 1;
  if (dist >= maxDist) return minGain;
  const t = (maxDist - dist) / (maxDist - minDist);
  return minGain + t * (1 - minGain);
}

/** Combined gain for a positioned event: distance × density duck. */
export function eventGain(
  dist: number,
  active: number,
  cfg: AudioDuckCfg = DEFAULT_AUDIO_DUCK,
): number {
  return distanceGain(dist, cfg) * duckGain(active, cfg);
}
