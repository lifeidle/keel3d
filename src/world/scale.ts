// Operation scale — the main-menu difficulty pick (squad skirmish up to a
// grand battle). Pure runtime state, so it can change between operations
// without touching the static CONFIG object.
import { CONFIG, type ScaleKey } from '../config';
export type { ScaleKey };

export interface OpScale {
  key: ScaleKey;
  enemies: number; // hostile riflemen
  allies: number; // friendly squad size
  dmgMul: number; // hostile damage multiplier
  hpMul: number; // hostile health multiplier
  reserve: number; // late reinforcements still to march in (0 = none)
}

const KEY = 'sf-scale';

export const SCALES: Record<ScaleKey, OpScale> = {
  patrol: {
    key: 'patrol',
    enemies: CONFIG.scale.patrol.enemies,
    allies: CONFIG.scale.patrol.allies,
    dmgMul: CONFIG.scale.patrol.dmgMul,
    hpMul: CONFIG.scale.patrol.hpMul,
    reserve: CONFIG.scale.patrol.reserve,
  },
  standard: {
    key: 'standard',
    enemies: CONFIG.scale.standard.enemies,
    allies: CONFIG.scale.standard.allies,
    dmgMul: CONFIG.scale.standard.dmgMul,
    hpMul: CONFIG.scale.standard.hpMul,
    reserve: CONFIG.scale.standard.reserve,
  },
  grand: {
    key: 'grand',
    enemies: CONFIG.scale.grand.enemies,
    allies: CONFIG.scale.grand.allies,
    dmgMul: CONFIG.scale.grand.dmgMul,
    hpMul: CONFIG.scale.grand.hpMul,
    reserve: CONFIG.scale.grand.reserve,
  },
};

let current: OpScale = SCALES.standard;

export function loadScale(): OpScale {
  try {
    const k = localStorage.getItem(KEY);
    if (k === 'patrol' || k === 'grand') return (current = SCALES[k]);
  } catch {
    /* private mode — standard */
  }
  current = SCALES.standard;
  return current;
}

export function setScale(key: ScaleKey): OpScale {
  current = SCALES[key];
  try {
    localStorage.setItem(KEY, key);
  } catch {
    /* ignore */
  }
  return current;
}

/** Current operation scale (safe in tests: never touches the DOM storage). */
export function opScale(): OpScale {
  return current;
}
