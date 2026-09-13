/**
 * Driveable tank / jeep step while the player is boarded.
 * A10: vehicle branch of fixedUpdate.
 */
import { CONFIG } from '../../../config';
import { t } from '../../../i18n';
import type { System, EngineWorld } from '../../../engine/types';
import { Jeep } from '../world/jeep';
import type { Game } from '../game';

export class VehicleSystem implements System {
  readonly name = 'nightraid.vehicle';
  private rattleCd = 0;

  constructor(private game: Game) {}

  fixedUpdate(dt: number, world: EngineWorld): void {
    if (!world.playing) return;
    const v = this.game.vehicleFrame;
    const driving = v.driving;
    if (!driving) return;

    // tank driver: player body is parked inside the hull; drive + gun
    const mv = v.input.moveAxis();
    const mouse = v.input.consumeMouse();
    const fire = v.input.fireDown;
    driving.updatePlayer(
      dt,
      mv,
      mouse,
      fire,
      v.camera,
      v.tankCamThird,
      v.player.sensMul,
    );
    // keep the player's body glued to the tank so enemy fire can't hit a
    // "ghost" standing outside (he's inside armour — bullets tickle the hull)
    const tp = driving.pos;
    v.player.pos.set(tp.x, tp.y + 0.2, tp.z);
    // engine drone follows the throttle
    const maxV = driving instanceof Jeep ? CONFIG.jeep.maxSpeed : CONFIG.tank.maxSpeed;
    v.audio.setEnginePitch(Math.abs(driving.speed) / maxV);
    // off-road rattle: random mechanical clunks past walking pace
    if (Math.abs(driving.speed) > 3) {
      this.rattleCd -= dt;
      if (this.rattleCd <= 0) {
        this.rattleCd = 0.35 + Math.random() * 0.9;
        v.audio.playRattle();
      }
    } else {
      this.rattleCd = 0;
    }
    // hull HP drives the health bar while driving (armour readout)
    v.hud.setHealth(driving.hp, driving.maxHp);
    v.hud.setHealthLabel(t('hud.armor'));
    // jeep: the pintle MG belt takes over the ammo readout
    if (driving instanceof Jeep) {
      v.hud.setAmmo(driving.mgAmmo, 0, driving.mgReloadT > 0);
    }
    v.enemies.update(dt, v.player, v.onPlayerDamage);
    v.barrels.update(dt);
    v.destructibles.update(dt);
    v.physics.step();
    v.enemyTankTick(dt);
    v.hudMissionTick(dt, driving.pos);
  }
}
