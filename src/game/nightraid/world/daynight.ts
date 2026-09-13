// Day / night master switch. One place owns the two visual moods: sky colour,
// fog tint, hemisphere fill, and the key light (moon by night — sun by day).
// The choice is made on the main menu, persisted to localStorage, and applied
// live so the menu backdrop itself changes while you pick.
import * as THREE from 'three';
import type { Engine } from '../../../engine/renderer';

export type TimeMode = 'night' | 'day';

export interface Palette {
  /** scene.background + fog colour */
  sky: number;
  /** hemisphere light (sky, ground, intensity) */
  hemiSky: number;
  hemiGround: number;
  hemiInt: number;
  /** key light (moon/sun) base tint + intensity before the per-seed mood */
  keyColor: number;
  keyInt: number;
  /** key light direction (position of the DirectionalLight) */
  keyPos: [number, number, number];
  /** stars + moon disc are only shown at night */
  stars: boolean;
  /** day-mode sky floor colour blended with `sky` by the weather's dayMix
   *  (clear → bright blue, storm → overcast grey). Unused at night. */
  overcast?: number;
  /** fog visibility multipliers applied on top of the per-weather near/far */
  fogNearMul: number;
  fogFarMul: number;
}

export const PALETTES: Record<TimeMode, Palette> = {
  night: {
    sky: 0x0a0e16,
    hemiSky: 0x46648f,
    hemiGround: 0x1c2418,
    hemiInt: 0.6,
    keyColor: 0xbfd4ff,
    keyInt: 0.55,
    keyPos: [-50, 90, -30],
    stars: true,
    fogNearMul: 1,
    fogFarMul: 1,
  },
  day: {
    sky: 0x9db4cc,
    overcast: 0x6a7280,
    hemiSky: 0xbcd0e4,
    hemiGround: 0x54584a,
    hemiInt: 1.05,
    keyColor: 0xfff2dd,
    keyInt: 2.1,
    keyPos: [70, 120, 40],
    stars: false,
    // daytime haze is lighter than the night murk — push sightlines out
    fogNearMul: 1.6,
    fogFarMul: 1.9,
  },
};

/** localStorage key shared with game.ts settings persistence. */
export const TIME_KEY = 'sf-time';

export function loadTimeMode(): TimeMode {
  try {
    return localStorage.getItem(TIME_KEY) === 'day' ? 'day' : 'night';
  } catch {
    return 'night';
  }
}

export function saveTimeMode(m: TimeMode) {
  try {
    localStorage.setItem(TIME_KEY, m);
  } catch {
    /* private mode — session-only choice */
  }
}

/**
 * Apply a time-of-day mood to the engine's shared lights + sky.
 * `keyOverride` lets the per-seed moon mood (colour + intensity) win over the
 * palette base at night; during the day the palette sun is used as-is.
 * `fogBase` is the weather's chosen near/far/bg; the palette scales it so a
 * clear day reaches much farther than a clear night without changing Weather.
 */
export function applyDayNight(
  engine: Engine,
  mode: TimeMode,
  fogBase?: { near: number; far: number; bg: number; dayMix?: number } | null,
  keyOverride?: { color: number; intensity: number } | null
) {
  const p = PALETTES[mode];
  const key = engine.moon; // the single directional light doubles as sun/moon
  let useKey = mode === 'night' && keyOverride ? keyOverride : { color: p.keyColor, intensity: p.keyInt };
  if (mode === 'day') {
    // bad weather dims the sun behind cloud (storm ≈ overcast, clear = full)
    const mix = fogBase?.dayMix ?? 0.94;
    useKey = { color: useKey.color, intensity: p.keyInt * (0.3 + 0.7 * mix) };
  }
  key.color.setHex(useKey.color);
  key.intensity = useKey.intensity;
  key.position.set(...p.keyPos);

  engine.hemi.color.setHex(p.hemiSky);
  engine.hemi.groundColor.setHex(p.hemiGround);
  engine.hemi.intensity = p.hemiInt;

  if (engine.skyNight) engine.skyNight.visible = p.stars;
  if (engine.skyDay) engine.skyDay.visible = !p.stars;

  // sky + fog: at night keep the weather's own dark bg; by day blend a bright
  // blue sky toward overcast grey according to how bad the weather is.
  let bg: number;
  if (mode === 'day') {
    const mix = fogBase?.dayMix ?? 0.94;
    const c = new THREE.Color(p.sky).lerp(new THREE.Color(p.overcast ?? p.sky), 1 - mix);
    bg = c.getHex();
  } else {
    bg = fogBase?.bg ?? p.sky;
  }
  (engine.scene.background as THREE.Color).setHex(bg);
  const fog = engine.scene.fog as THREE.Fog;
  if (fogBase) {
    fog.color.setHex(bg);
    fog.near = fogBase.near * p.fogNearMul;
    fog.far = fogBase.far * p.fogFarMul;
  }
}
