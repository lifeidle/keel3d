/**
 * Composition root — static game registry.
 * This file MAY import content packages; engine/blocks/content must NOT.
 * Scaffold (`npm run new-game`) inserts a new line here.
 */
import type { DefinedGame } from './content/defineGame';

export type GameLoader = () => Promise<{ default: DefinedGame }>;

export const DEFAULT_GAME_ID = 'nightraid';

export const GAME_LOADERS: Record<string, GameLoader> = {
  // Sample A — full FPS (special boot path in main.ts)
  nightraid: () => import('./game/nightraid/module'),
  tower: () => import('./game/demo-tower'),
  cultivation: () => import('./game/demo-cultivation'),
  template: () => import('./game/demo-template'),
  flight: () => import('./game/demo-flight'),
  race: () => import('./game/demo-race'),
  // NEW_GAME_INSERT
};

export function resolveGameId(): string {
  const fromWindow = (globalThis as { __GAME_ID__?: string }).__GAME_ID__;
  if (fromWindow && fromWindow in GAME_LOADERS) return fromWindow;
  const q = new URLSearchParams(location.search).get('game');
  if (q && q in GAME_LOADERS) return q;
  // pathname /tower.html → tower
  const base = location.pathname.split('/').pop() ?? '';
  const m = base.match(/^([a-z0-9-]+)\.html$/i);
  if (m && m[1] in GAME_LOADERS && m[1] !== 'index') return m[1];
  return DEFAULT_GAME_ID;
}

export async function loadGame(id: string): Promise<DefinedGame> {
  const loader = GAME_LOADERS[id];
  if (!loader) throw new Error(`[registry] unknown game id: ${id}`);
  const mod = await loader();
  return mod.default;
}

export function listGameIds(): string[] {
  return Object.keys(GAME_LOADERS);
}
