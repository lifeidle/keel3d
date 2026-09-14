/**
 * Composition root — static game registry.
 * This file MAY import content packages; engine/blocks/content must NOT.
 * Scaffold (`npm run new-game`) inserts a new line here.
 *
 * Entry is selected by HTML page (`window.__GAME_ID__` or filename),
 * not by query-string.
 */
import type { DefinedGame } from './content/defineGame';

export type GameLoader = () => Promise<{ default: DefinedGame }>;

export const DEFAULT_GAME_ID = 'nightraid';

export const GAME_LOADERS: Record<string, GameLoader> = {
  // Full FPS skeleton (special boot path in main.ts)
  nightraid: () => import('./game/nightraid/module'),
  tower: () => import('./game/demo-tower'),
  cultivation: () => import('./game/demo-cultivation'),
  template: () => import('./game/demo-template'),
  flight: () => import('./game/demo-flight'),
  race: () => import('./game/demo-race'),
  arpgdemo: () => import('./game/demo-arpg'),
  collectdemo: () => import('./game/demo-collect'),
  rallydemo: () => import('./game/demo-rally'),
  dungeondemo: () => import('./game/demo-dungeon'),
  flightarena: () => import('./game/demo-flight-arena'),
  fpsarena: () => import('./game/demo-fps-arena'),
  tps: () => import('./game/demo-tps'),
  rogue: () => import('./game/demo-rogue'),
  plat: () => import('./game/demo-plat'),
  tycoon: () => import('./game/demo-tycoon'),
  rts: () => import('./game/demo-rts'),
  stealth: () => import('./game/demo-stealth'),
  // NEW_GAME_INSERT
};

/** HTML filename stem → registry id (when they differ). */
const FILE_ALIASES: Record<string, string> = {
  index: DEFAULT_GAME_ID,
  fps: 'nightraid',
  openworld: 'cultivation',
};

export function resolveGameId(): string {
  const fromWindow = (globalThis as { __GAME_ID__?: string }).__GAME_ID__;
  if (fromWindow && fromWindow in GAME_LOADERS) return fromWindow;

  const base = (location.pathname.split('/').pop() || '').replace(/\.html$/i, '');
  if (base && base in FILE_ALIASES) return FILE_ALIASES[base];
  if (base && base in GAME_LOADERS) return base;

  return DEFAULT_GAME_ID;
}

export async function loadGame(id: string): Promise<DefinedGame> {
  const loader = GAME_LOADERS[id];
  if (!loader) {
    const known = listGameIds().join(', ');
    throw new Error(`[registry] unknown game id: "${id}". Known: ${known}`);
  }
  const mod = await loader();
  return mod.default;
}

export function listGameIds(): string[] {
  return Object.keys(GAME_LOADERS);
}
