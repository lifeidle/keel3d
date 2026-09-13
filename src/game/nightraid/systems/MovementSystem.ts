/**
 * Player locomotion / stance (infantry branch).
 * A8: player.update call extracted from fixedUpdate.
 * Runs BEFORE CombatSim so weapon/enemies/physics still see the new pose.
 */
import type { System, EngineWorld } from '../../../engine/types';
import type { Game } from '../game';

export class MovementSystem implements System {
  readonly name = 'nightraid.movement';
  constructor(private game: Game) {}

  fixedUpdate(dt: number, world: EngineWorld): void {
    if (!world.playing) return;
    const m = this.game.movementFrame;
    // vehicle branch owns the body while driving (A10)
    if (m.driving) return;
    m.player.update(dt, m.input, m.camera);
  }
}
