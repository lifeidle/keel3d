/** Weather, sky dressing, muzzle/flare light decay. */
import type { System, EngineWorld } from '../../../engine/types';
import type { Game } from '../game';

export class AtmosphereSystem implements System {
  readonly name = 'nightraid.atmosphere';
  constructor(private game: Game) {}
  update(ft: number, world: EngineWorld): void {
    this.game.hostAtmosphereFrame(ft, world.playing);
  }
}
