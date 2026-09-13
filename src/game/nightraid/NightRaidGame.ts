/**
 * NightRaidGame — sample GameModule on the engine kernel.
 * Registers extracted systems; the legacy Game remains the combat owner
 * but no longer runs its own rAF when mounted under an Engine host.
 */
import type { GameModule, System, EngineHost } from '../../engine/types';
import type { Game } from './game';
import {
  StateSyncSystem,
  MovementSystem,
  CombatSimSystem,
  GameplayFrameSystem,
  EffectsSystem,
  AtmosphereSystem,
  QualityAutoSystem,
  RenderPresentSystem,
  HudSystem,
  MissionSystem,
} from './systems';

export interface NightRaidDeps {
  game: Game;
}

export function createNightRaidGame(deps: NightRaidDeps): GameModule {
  const g = deps.game;
  // Order matters: Movement (player pose) BEFORE Combat (weapon/enemies/physics).
  const systems: System[] = [
    new StateSyncSystem(g),
    new MovementSystem(g),
    new CombatSimSystem(g),
    new MissionSystem(g),
    new GameplayFrameSystem(g),
    new HudSystem(g),
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
