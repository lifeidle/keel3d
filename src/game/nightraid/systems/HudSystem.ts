/**
 * HUD / tactical map / viewmodel presentation frame.
 * A6: spread, minimap, full map, gunfire arc, viewmodel bob/kick.
 */
import { CONFIG } from '../../../config';
import type { System } from '../../../engine/types';
import type { Game } from '../game';

type HudFrame = Game['hudFrame'];

export class HudSystem implements System {
  readonly name = 'nightraid.hud';
  private bobPhase = 0;

  constructor(private game: Game) {}

  update(ft: number): void {
    const frame = this.game.hudFrame;

    const hudEl = document.getElementById('hud');
    if (hudEl) {
      hudEl.style.display =
        frame.state === 'playing' || frame.state === 'paused' ? '' : 'none';
    }

    if (frame.state === 'playing' || frame.state === 'paused') {
      frame.tactical.update(
        frame.playerPos.x,
        frame.playerPos.z,
        frame.playerYaw,
        frame.enemyTargets(),
        frame.map.obstacles,
        CONFIG.map.half,
        frame.barrelBlips(),
        frame.exfilBlip(),
        frame.ammoDumps,
      );
    }

    if (frame.state === 'playing') {
      if (frame.driving) {
        frame.hideGunModels();
        frame.hud.setSpread(0);
      } else {
        const mv = frame.moveAxis();
        const moving = mv.x !== 0 || mv.z !== 0;
        const spread =
          4 + frame.recoilLevel * 26 + (moving ? (mv.sprint ? 9 : 5) : 0);
        frame.hud.setSpread(spread);
        this.animateViewmodel(ft, frame);
      }
      this.updateFireIndicators(frame);
    }

    if (frame.state === 'playing' && frame.fullmapOpen) {
      frame.tactical.drawFullMap(
        frame.playerPos.x,
        frame.playerPos.z,
        frame.playerYaw,
        frame.soldiers(),
        frame.map.obstacles,
        CONFIG.map.half,
        frame.ammoDumps,
        frame.map.camp,
        frame.map.base,
      );
    }
  }

  /**
   * Render-frame viewmodel motion: a kick that spikes on fire and settles, plus
   * a subtle walk/sprint bob. Resting pose is (0.26, -0.24, -0.7).
   */
  private animateViewmodel(ft: number, frame: HudFrame): void {
    const g = frame.activeGun;
    if (!g) return;
    frame.stepGunKick(ft);
    const k = frame.gunKick;
    const mv = frame.moveAxis();
    const moving = mv.x !== 0 || mv.z !== 0;
    if (moving) this.bobPhase += ft * (mv.sprint ? 12 : 7.5);
    const amp = moving ? (mv.sprint ? 1 : 0.55) : 0;
    const b = Math.sin(this.bobPhase);
    g.position.set(
      0.26 + Math.cos(this.bobPhase) * 0.014 * amp + (Math.random() - 0.5) * k * 0.012,
      -0.24 + Math.abs(b) * 0.02 * amp + k * 0.015,
      -0.7 + k * 0.07,
    );
    g.rotation.set(
      k * 0.16,
      0,
      Math.cos(this.bobPhase) * 0.022 * amp + (Math.random() - 0.5) * k * 0.04,
    );
  }

  /** Amber arc toward the freshest enemy trigger pull (~90ms window). */
  private updateFireIndicators(frame: HudFrame): void {
    const now = performance.now() / 1000;
    let best: { x: number; z: number } | null = null;
    let bestAge = Infinity;
    for (const e of frame.enemies()) {
      if (!e.alive) continue;
      const age = now - e.lastShot;
      if (age < bestAge) {
        bestAge = age;
        const t = e.body.translation();
        best = { x: t.x, z: t.z };
      }
    }
    if (!best || bestAge > 0.09) return;
    const dx = best.x - frame.playerPos.x;
    const dz = best.z - frame.playerPos.z;
    const yaw = frame.playerYaw;
    const fwd = dx * -Math.sin(yaw) + dz * -Math.cos(yaw);
    const right = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
    frame.hud.gunfireDirection(Math.atan2(right, fwd));
  }
}
