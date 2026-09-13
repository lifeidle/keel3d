/**
 * defineGame — turn a GameSpec into a framework-mountable GameModule.
 * Phase C contract: content packages never import engine internals directly.
 */
import type { GameSpec } from './define';
import type { GameModule, System } from '../engine/types';

export interface DefinedGame extends GameModule {
  spec: GameSpec;
}

/**
 * Wrap a content spec + system list as a GameModule.
 * Systems are supplied by the sample (until defineGame grows a full host).
 */
export function defineGame(
  spec: GameSpec,
  systems: System[] = [],
  mount?: (host: unknown) => void,
): DefinedGame {
  return {
    id: spec.id,
    spec,
    systems,
    mount(host: unknown) {
      mount?.(host);
    },
  };
}

export type { GameSpec, MapSpec, FixedMapDef, UnitDef, CameraSpec, CameraMode } from './define';
