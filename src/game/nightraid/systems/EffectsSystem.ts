/**
 * Transient VFX: tracers, casings, fires, smoke plumes.
 * A4: body moved out of game.ts hostEffectsFrame.
 */
import type { System } from '../../../engine/types';
import type { Game } from '../game';

export class EffectsSystem implements System {
  readonly name = 'nightraid.effects';
  constructor(private game: Game) {}
  update(ft: number): void {
    const v = this.game.vfx;
    v.effects.update(ft);
    v.fires.update(ft);
    v.plumes.update(ft);
    v.casings.update(ft);
  }
}
