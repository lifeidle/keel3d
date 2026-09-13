// Visual quality tiers: low / med / high. Drives shadow casting, shadow-map
// resolution, device-pixel-ratio cap, rain density, and — since the V6 open
// world — fog reach & distant-scenery density (fogFarMul / worldDetail).
// Auto-detected on first run from CPU cores + pointer type; the player can
// override in Settings.
export type Quality = 'low' | 'med' | 'high';

export interface QualitySettings {
  shadows: boolean;
  shadowSize: number;
  pixelRatio: number;
  rainScale: number;
  /** how far fog reaches relative to the per-weather baseline (low = closer) */
  fogFarMul: number;
  /** distant scenery (skyline silhouettes, wilderness scatter) density 0..1 */
  worldDetail: number;
}

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { shadows: false, shadowSize: 512, pixelRatio: 1, rainScale: 0.4, fogFarMul: 0.78, worldDetail: 0.45 },
  med: { shadows: true, shadowSize: 1024, pixelRatio: 1.5, rainScale: 0.7, fogFarMul: 0.9, worldDetail: 0.7 },
  high: { shadows: true, shadowSize: 2048, pixelRatio: 2, rainScale: 1, fogFarMul: 1, worldDetail: 1 },
};

/** Pick a sensible default before any saved preference exists. */
export function detectQuality(): Quality {
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency || 4;
    // Phones/tablets: a modern 6+ core SoC can carry 'med', weaker ones need 'low'.
    if (coarse) return cores >= 6 ? 'med' : 'low';
    if (cores <= 2) return 'low';
    if (cores <= 4) return 'med';
  } catch {
    /* no matchMedia / hardwareConcurrency — fall through to high */
  }
  return 'high';
}
