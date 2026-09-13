/** Transient VFX: tracers, casings, fires, smoke plumes. */
import type { System } from '../../../engine/types';
import type { Game } from '../game';

export class EffectsSystem implements System {
  readonly name = 'nightraid.effects';
  constructor(private game: Game) {}
  update(ft: number): void {
    this.game.hostEffectsFrame(ft);
  }
}
