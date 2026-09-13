/** Shared engine contracts — game-agnostic. */

export interface System {
  readonly name: string;
  init?(world: EngineWorld): void;
  /** Variable-rate (render) step. */
  update?(dt: number, world: EngineWorld): void;
  /** Fixed-rate simulation step (1/60). */
  fixedUpdate?(dt: number, world: EngineWorld): void;
  dispose?(): void;
}

export interface GameModule {
  readonly id: string;
  readonly systems: System[];
  mount(engine: EngineHost): void | Promise<void>;
  unmount?(): void;
}

/** Minimal world surface systems may rely on. */
export interface EngineWorld {
  readonly services: import('./services').EngineServices;
  /** Wall-clock seconds since engine start. */
  readonly time: number;
  /** True while a match/operation is actively simulating. */
  playing: boolean;
}

export interface EngineHost {
  readonly world: EngineWorld;
  addSystem(s: System): void;
  removeSystem(name: string): void;
}

export type EngineState = 'boot' | 'menu' | 'intro' | 'playing' | 'paused' | 'over';

export interface Diagnostics {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  renderScale: number;
}
