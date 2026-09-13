/**
 * NightRaidGame — sample GameModule on the engine kernel.
 * Registers extracted systems; the legacy Game remains the combat owner
 * but no longer runs its own rAF when mounted under an Engine host.
 */
import type { GameModule, System, EngineHost } from '../../engine/types';
import type { Game } from './game';
import {
  StateSyncSystem,
  CombatSimSystem,
  GameplayFrameSystem,
  EffectsSystem,
  AtmosphereSystem,
  QualityAutoSystem,
  RenderPresentSystem,
} from './systems/FrameSystems';

export interface NightRaidDeps {
  game: Game;
}

export function createNightRaidGame(deps: NightRaidDeps): GameModule {
  const g = deps.game;
  const systems: System[] = [
    new StateSyncSystem(g),
    new CombatSimSystem(g),
    new GameplayFrameSystem(g),
    new EffectsSystem(g),
    new AtmosphereSystem(g),
    new QualityAutoSystem(g),
    new RenderPresentSystem(g),
  ];

  return {
    id: 'nightraid',
    systems,
    mount(_engine: EngineHost) {
      // Systems are registered by the Engine host before mount.
    },
  };
}
