/** Final present + HUD/diag sampling. */
import type { System } from '../../../engine/types';
import type { Game } from '../game';

export class RenderPresentSystem implements System {
  readonly name = 'nightraid.present';
  constructor(private game: Game) {}
  update(ft: number): void {
    this.game.hostPresent(ft);
  }
}
