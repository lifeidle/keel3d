/**
 * defineGame — turn a GameSpec into a framework-mountable GameModule.
 * Content packages describe the game; systems stay supplied by the sample.
 */
import type { GameSpec } from './define';
import type { EngineHost, GameModule, System } from '../engine/types';

export interface DefinedGame extends GameModule {
  spec: GameSpec;
}

export function defineGame(
  spec: GameSpec,
  systems: System[] = [],
  mount?: (host: EngineHost) => void,
): DefinedGame {
  return {
    id: spec.id,
    spec,
    systems,
    mount(host: EngineHost) {
      mount?.(host);
    },
  };
}

export type { GameSpec, MapSpec, FixedMapDef, UnitDef, CameraSpec, CameraMode } from './define';
