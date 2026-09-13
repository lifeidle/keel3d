/**
 * defineGame — wrap a GameSpec as the content package default export.
 * Validates essential fields so bad specs fail fast with a clear message.
 * `create` is optional at define time (legacy mount-path games like nightraid);
 * instantiate() still requires it.
 */
import type { GameCreateContext, GameInstance, GameSpec } from './define';
import type { EngineHost, GameModule, System } from '../engine/types';

export interface DefinedGame extends GameModule {
  spec: GameSpec;
  instantiate?(ctx: GameCreateContext): GameInstance;
}

export function defineGame(spec: GameSpec): DefinedGame {
  if (!spec || typeof spec !== 'object') {
    throw new Error('[defineGame] spec must be an object');
  }
  if (!spec.id || typeof spec.id !== 'string') {
    throw new Error('[defineGame] spec.id is required (string)');
  }
  if (!spec.title) {
    throw new Error(`[defineGame] ${spec.id}: spec.title is required`);
  }
  if (spec.create != null && typeof spec.create !== 'function') {
    throw new Error(
      `[defineGame] ${spec.id}: spec.create must be a function (ctx) => GameInstance`,
    );
  }

  const systems: System[] = [];
  return {
    id: spec.id,
    spec,
    systems,
    instantiate(ctx: GameCreateContext): GameInstance {
      if (typeof spec.create !== 'function') {
        throw new Error(`[defineGame] ${spec.id} has no create() factory`);
      }
      return spec.create(ctx);
    },
    mount(_host: EngineHost) {
      // Host (mountSampleGame) registers systems before mount.
    },
  };
}

/** Shared recipe option shape. */
export interface BaseRecipeOpts {
  id: string;
  title?: string;
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
