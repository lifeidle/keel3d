/**
 * NightRaid systems — extract slices of the legacy Game loop into Engine Systems
 * so the framework kernel owns scheduling while Night Raid remains a sample module.
 */
import type { System, EngineWorld } from '../../../engine/types';
import type { Game } from '../game';

/** Mirror Game screen state onto EngineWorld.playing (gates fixedUpdate). */
export class StateSyncSystem implements System {
  readonly name = 'nightraid.state';
  constructor(private game: Game) {}
  update(_ft: number, world: EngineWorld): void {
    const playing = this.game.screenState === 'playing';
    if (world.playing !== playing) world.playing = playing;
  }
}

/** Fixed-rate combat sim (physics steps, AI, weapons, mission). */
export class CombatSimSystem implements System {
  readonly name = 'nightraid.combat';
  constructor(private game: Game) {}
  fixedUpdate(dt: number): void {
    this.game.hostFixedUpdate(dt);
  }
}

/** Variable-rate gameplay: menus, HUD, viewmodel, net, mission tail. */
export class GameplayFrameSystem implements System {
  readonly name = 'nightraid.gameplay';
  constructor(private game: Game) {}
  update(ft: number): void {
    this.game.hostGameplayFrame(ft);
  }
}

/** Transient VFX: tracers, casings, fires, smoke plumes. */
export class EffectsSystem implements System {
  readonly name = 'nightraid.effects';
  constructor(private game: Game) {}
  update(ft: number): void {
    this.game.hostEffectsFrame(ft);
  }
}

/** Weather, sky dressing, muzzle/flare light decay. */
export class AtmosphereSystem implements System {
  readonly name = 'nightraid.atmosphere';
  constructor(private game: Game) {}
  update(ft: number, world: EngineWorld): void {
    this.game.hostAtmosphereFrame(ft, world.playing);
  }
}

/** Sustained-low-fps tier downgrade (after dynamic render-scale). */
export class QualityAutoSystem implements System {
  readonly name = 'nightraid.quality-auto';
  constructor(private game: Game) {}
  update(ft: number, world: EngineWorld): void {
    if (world.playing) this.game.hostQualityAuto(ft);
  }
}

/** Final present + HUD/diag sampling. */
export class RenderPresentSystem implements System {
  readonly name = 'nightraid.present';
  constructor(private game: Game) {}
  update(ft: number): void {
    this.game.hostPresent(ft);
  }
}
