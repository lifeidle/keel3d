/**
 * Weather, sky dressing, muzzle/flare light decay.
 * A5: hostAtmosphereFrame + fadeMuzzleLights + nightClouds drift.
 */
import type { System, EngineWorld } from '../../../engine/types';
import type { Game } from '../game';

export class AtmosphereSystem implements System {
  readonly name = 'nightraid.atmosphere';
  constructor(private game: Game) {}

  update(ft: number, world: EngineWorld): void {
    const a = this.game.atmosphere;
    if (
      a.state === 'playing' ||
      a.state === 'paused' ||
      a.state === 'menu' ||
      a.state === 'intro'
    ) {
      a.weather.update(ft, a.cameraPos);
    }
    this.fadeMuzzleLights(a.muzzleLights, ft);
    if (a.nightClouds) a.nightClouds.rotation.y += ft * 0.006;
    void world;
  }

  private fadeMuzzleLights(
    lights: Array<{ intensity: number }>,
    ft: number,
  ): void {
    const k = Math.exp(-ft * 11);
    for (const l of lights) {
      if (l.intensity > 0.02) l.intensity *= k;
      else if (l.intensity !== 0) l.intensity = 0;
    }
  }
}
