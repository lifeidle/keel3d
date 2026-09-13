/** Variable-rate gameplay: menus, HUD, viewmodel, net, mission tail. */
import type { System } from '../../../engine/types';
import type { Game } from '../game';

export class GameplayFrameSystem implements System {
  readonly name = 'nightraid.gameplay';
  constructor(private game: Game) {}
  update(ft: number): void {
    this.game.hostGameplayFrame(ft);
  }
}
