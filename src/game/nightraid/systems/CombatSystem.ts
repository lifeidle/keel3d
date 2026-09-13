/**
 * Infantry combat step: weapon, ADS FOV, enemies, barrels, physics, tank AI.
 * A9: body extracted from fixedUpdate. Call order is the feel contract —
 * physics.step stays last among world simulators.
 */
import type { System, EngineWorld } from '../../../engine/types';
import type { Game } from '../game';

export class CombatSystem implements System {
  readonly name = 'nightraid.combat-step';
  constructor(private game: Game) {}

  fixedUpdate(dt: number, world: EngineWorld): void {
    if (!world.playing) return;
    const c = this.game.combatFrame;
    if (c.driving) return; // vehicle branch (A10)

    const fireClick = c.input.consumeFireClick();
    c.weapon.ads = c.input.adsToggle;
    c.weapon.update(dt, c.input.fireDown, fireClick, c.camera);

    // ADS: zoom the FOV toward 75/zoom and soften the mouse while aiming
    const baseFov = 75;
    const targetFov = baseFov / (c.weapon.ads ? c.weapon.def.zoom : 1);
    if (Math.abs(c.camera.fov - targetFov) > 0.05) {
      c.camera.fov += (targetFov - c.camera.fov) * Math.min(1, dt * 12);
      c.camera.updateProjectionMatrix();
    }
    c.player.adsMul = c.weapon.ads ? 0.55 : 1;
    // sniper glass at 2x+: vignette + crosshair overlay
    c.hud.setScope(c.weapon.ads && (c.weapon.def.zoom ?? 1) >= 2);

    c.enemies.update(dt, c.player, c.onPlayerDamage);
    c.barrels.update(dt);
    c.destructibles.update(dt);
    c.physics.step();

    c.enemyTankTick(dt);
    c.hudMissionTick(dt, c.player.pos);
    c.tankBoardHint(dt);
  }
}
