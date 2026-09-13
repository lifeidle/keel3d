/**
 * defineGame — wrap a GameSpec as the content package default export.
 */
import type { GameCreateContext, GameInstance, GameSpec } from './define';
import type { EngineHost, GameModule, System } from '../engine/types';

export interface DefinedGame extends GameModule {
  spec: GameSpec;
  /** Host calls this when the game has a create() factory. */
  instantiate?(ctx: GameCreateContext): GameInstance;
}

export function defineGame(spec: GameSpec): DefinedGame {
  const systems: System[] = [];
  return {
    id: spec.id,
    spec,
    systems,
    instantiate(ctx: GameCreateContext): GameInstance {
      if (!spec.create) {
        throw new Error(`[defineGame] ${spec.id} has no create() factory`);
      }
      return spec.create(ctx);
    },
    mount(_host: EngineHost) {
      // Host (mountSampleGame) registers systems before mount.
    },
  };
}

export type {
  GameSpec,
  GameCreateContext,
  GameInstance,
  MapSpec,
  FixedMapDef,
  UnitDef,
  CameraSpec,
  CameraMode,
} from './define';
