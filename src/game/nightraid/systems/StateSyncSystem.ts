/** Mirror Game screen state onto EngineWorld.playing (gates fixedUpdate). */
import type { System, EngineWorld } from '../../../engine/types';
import type { Game } from '../game';

export class StateSyncSystem implements System {
  readonly name = 'nightraid.state';
  constructor(private game: Game) {}
  update(_ft: number, world: EngineWorld): void {
    const playing = this.game.screenState === 'playing';
    if (world.playing !== playing) world.playing = playing;
  }
}
