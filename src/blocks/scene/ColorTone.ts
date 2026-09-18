/**
 * ColorTone — pure colour/tone ops on 0xRRGGBB numbers (R52).
 *
 * Framework gap: palette derivation (brighter nights, tinted moods,
 * fog blends) was done inline via `new THREE.Color(...).lerp` or by
 * hand-picked hex constants in content. These pure helpers let both the
 * framework (TimeOfDay) and content (yexi's readable night) DERIVE palettes
 * from the canonical base instead of magic numbers.
 *
 * Headless-testable: no THREE, no DOM.
 */

/** Channel-wise linear mix of two 0xRRGGBB colours (t clamped to 0..1). */
export function mixHex(a: number, b: number, t: number): number {
  const c = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return (
    (Math.round(ar + (br - ar) * c) << 16) |
    (Math.round(ag + (bg - ag) * c) << 8) |
    Math.round(ab + (bb - ab) * c)
  );
}

/**
 * Scale every channel by `k` (clamped 0..255). k > 1 brightens toward white
 * saturation, k < 1 darkens toward black.
 */
export function brighten(hex: number, k: number): number {
  const r = clamp255(Math.round(((hex >> 16) & 255) * k));
  const g = clamp255(Math.round(((hex >> 8) & 255) * k));
  const b = clamp255(Math.round((hex & 255) * k));
  return (r << 16) | (g << 8) | b;
}

/** Mix toward white by t (0..1) — a readability "lift". */
export function lift(hex: number, t: number): number {
  return mixHex(hex, 0xffffff, t);
}

/** Mix toward a target tint by t (0..1) — mood tinting. */
export function tint(hex: number, color: number, t: number): number {
  return mixHex(hex, color, t);
}

/**
 * Perceived brightness 0..1 (ITU-R BT.709 luma weights). Pure; handy for
 * asserting a palette is "readable" (ground/props visible at night).
 */
export function luminance(hex: number): number {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}
