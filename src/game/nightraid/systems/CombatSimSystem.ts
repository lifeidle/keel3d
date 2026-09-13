/** Fixed-rate combat sim (physics steps, AI, weapons, mission). */
import type { System } from '../../../engine/types';
import type { Game } from '../game';

export class CombatSimSystem implements System {
  readonly name = 'nightraid.combat';
  constructor(private game: Game) {}
  fixedUpdate(dt: number): void {
    this.game.hostFixedUpdate(dt);
  }
}
