/**
 * Engine — game-agnostic host. Owns loop, services, and system scheduling.
 * A GameModule registers systems; NightRaid is the first sample module.
 *
 * Headless mode (`headless: true`) skips creating a GPU canvas so a sample
 * game can keep its own three.js renderer while the kernel still owns rAF,
 * quality sampling, and system order.
 */
import * as THREE from 'three';
import type { EngineHost, EngineState, EngineWorld, System, Diagnostics } from './types';
import { Emitter, type EngineServices } from './services';
import { QualityController } from './quality/QualityController';
import { RendererFacade } from './render/RendererFacade';
import { AssetHub } from './assets/AssetHub';
import { AudioEngine } from './audio/AudioEngine';
import { Input } from './input';
import { PhysicsWorld } from '../physics/world';
import type { Quality } from '../world/quality';

const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.1;
const MAX_SUBSTEPS = 5;

export interface EngineOptions {
  parent: HTMLElement;
  quality?: Quality;
  /** Share one controller with a sample game (dynamic resolution single source). */
  qualityCtrl?: QualityController;
  /**
   * When true, do not create a GPU canvas. Systems + loop still run.
   * Used by NightRaid while legacy Game owns the three.js scene.
   */
  headless?: boolean;
}

/** Optional renderer in services when headless. */
export type EngineServicesOptional = Omit<EngineServices, 'renderer' | 'physics' | 'assets' | 'audio' | 'input'> &
  Partial<Pick<EngineServices, 'renderer' | 'physics' | 'assets' | 'audio' | 'input'>>;

export class Engine implements EngineHost {
  readonly world: EngineWorld;
  readonly services: EngineServices;
  private systems: System[] = [];
  private byName = new Map<string, System>();
  private state: EngineState = 'boot';
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time0 = 0;
  private headless: boolean;
  private diag: Diagnostics = {
    fps: 60,
    frameMs: 16.7,
    drawCalls: 0,
    triangles: 0,
    renderScale: 1,
  };

  constructor(opts: EngineOptions) {
    this.headless = !!opts.headless;
    const quality = opts.qualityCtrl ?? new QualityController(opts.quality);
    const events = new Emitter();
    const assets = new AssetHub();

    let renderer: RendererFacade | undefined;
    let physics: PhysicsWorld | undefined;
    let input: Input | undefined;
    let audio: AudioEngine | undefined;

    if (!this.headless) {
      renderer = new RendererFacade({
        parent: opts.parent,
        quality,
      });
      physics = new PhysicsWorld();
      input = new Input(renderer.raw.domElement);
      audio = new AudioEngine(assets);
    }

    this.services = {
      renderer: renderer!,
      physics: physics!,
      assets,
      audio: audio!,
      input: input!,
      quality,
      events,
    } as EngineServices;

    this.world = {
      services: this.services,
      time: 0,
      playing: false,
    };
  }

  get diagnostics(): Diagnostics {
    return { ...this.diag, renderScale: this.services.quality.renderScale };
  }

  get currentState(): EngineState {
    return this.state;
  }

  setState(s: EngineState): void {
    this.state = s;
    (this.world as { playing: boolean }).playing = s === 'playing';
  }

  addSystem(s: System): void {
    if (this.byName.has(s.name)) {
      console.warn(`[engine] system ${s.name} already registered — replacing`);
      this.removeSystem(s.name);
    }
    this.systems.push(s);
    this.byName.set(s.name, s);
    s.init?.(this.world);
  }

  removeSystem(name: string): void {
    const s = this.byName.get(name);
    if (!s) return;
    s.dispose?.();
    this.byName.delete(name);
    this.systems = this.systems.filter((x) => x !== s);
  }

  getSystem<T extends System>(name: string): T | undefined {
    return this.byName.get(name) as T | undefined;
  }

  /** Start the rAF loop. Call after services + systems are ready. */
  start(): void {
    if (this.raf) return;
    this.time0 = performance.now();
    this.last = this.time0;
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      try {
        this.frame(now);
      } catch (err) {
        console.error('[engine] frame', err);
      }
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame(now: number): void {
    const ft = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;
    (this.world as { time: number }).time = (now - this.time0) / 1000;

    const ms = ft * 1000;
    this.diag.frameMs += (ms - this.diag.frameMs) * 0.1;
    this.diag.fps += (1000 / Math.max(ms, 0.1) - this.diag.fps) * 0.1;
    this.services.quality.sampleFrame(ms);

    if (this.world.playing) {
      this.acc += ft;
      const maxAcc = FIXED_DT * MAX_SUBSTEPS;
      if (this.acc > maxAcc) this.acc = maxAcc;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < MAX_SUBSTEPS) {
        for (const s of this.systems) s.fixedUpdate?.(FIXED_DT, this.world);
        this.acc -= FIXED_DT;
        steps++;
      }
      if (steps >= MAX_SUBSTEPS) this.acc = 0;
    }

    for (const s of this.systems) s.update?.(ft, this.world);
    // WebGPU-only: three's WebGPURenderer exposes no render.info — draw-calls /
    // triangles stay at 0 until a WebGPU diagnostics surface is wired up.
  }

  dispose(): void {
    this.stop();
    for (const s of this.systems) s.dispose?.();
    this.systems = [];
    this.byName.clear();
    this.services.events.clear();
    this.services.renderer?.dispose();
  }
}

// Re-export THREE for systems that need scene types without importing three twice.
export type { THREE };
