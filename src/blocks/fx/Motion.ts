/**
 * Motion — oscillation helpers for presentation (R88). Pure, headless.
 *
 * Gap: content hand-rolls `0.5 + 0.5·sin(…)` / `amp·sin(…)` all over
 * (fire flicker, fuse flash, pulsing markers, floating bobs). These are
 * the two standard forms, made shared and clamped/deterministic.
 */

/**
 * Smooth 0 → 1 → 0 over `period` seconds (cosine — starts at 0).
 * Wraps periodically; negative pre-spawn time (t + phase < 0) clamps to 0.
 */
export function pulse(t: number, period = 1.2, phase = 0): number {
  if (!(period > 0) || !Number.isFinite(period)) {
    throw new Error('pulse: period must be finite and > 0');
  }
  const tt = Math.max(0, t + phase);
  const k = (tt / period) % 1;
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * k);
}

/**
 * Vertical bob offset: `amp·sin(2π·t/period + phaseRad)` — for markers or
 * lights floating above the ground. `amp` >= 0.
 */
export function bobY(t: number, amp = 0.15, period = 1.6, phase = 0): number {
  if (!(amp >= 0) || !Number.isFinite(amp)) {
    throw new Error('bobY: amp must be finite and >= 0');
  }
  if (!(period > 0) || !Number.isFinite(period)) {
    throw new Error('bobY: period must be finite and > 0');
  }
  return amp * Math.sin((2 * Math.PI * t) / period + phase);
}
