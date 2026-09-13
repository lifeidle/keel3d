/** Sustained-low-fps tier downgrade (after dynamic render-scale). */
import type { System, EngineWorld } from '../../../engine/types';
import type { Game } from '../game';

export class QualityAutoSystem implements System {
  readonly name = 'nightraid.quality-auto';
  constructor(private game: Game) {}
  update(ft: number, world: EngineWorld): void {
    if (world.playing) this.game.hostQualityAuto(ft);
  }
}
