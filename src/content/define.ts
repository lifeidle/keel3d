/**
 * L3 contract — GameSpec / MapSpec / UnitDef + create context types.
 * See docs/STRUCTURE.md and docs/API.md.
 */
import type * as THREE from 'three';
import type { System } from '../engine/types';
import type { Engine } from '../engine/Engine';
import type { Engine as RendererEngine } from '../engine/renderer';

export type CameraMode = 'fps' | 'chase' | 'orbit' | 'free' | 'shoulder';

/** Seeded: procedural, same seed → same world. */
export interface SeededMapSpec {
  kind: 'seeded';
  gen: (seed: number) => unknown;
}

/** Fixed: hand-authored map pack. */
export interface FixedMapDef {
  id: string;
  title?: string;
  terrain: {
    size: number;
    amplitude?: number;
  };
  pois?: Array<{ id: string; x: number; y?: number; z: number }>;
  spawn?: Array<{ id: string; x: number; y?: number; z: number; side?: string }>;
  navmesh?: string;
}

export interface FixedMapSpec {
  kind: 'fixed';
  maps: FixedMapDef[];
}

/** Stream: chunked open world. */
export interface StreamMapSpec {
  kind: 'stream';
  root: string;
  chunk: number;
  lodRings: number[];
}

export type MapSpec = SeededMapSpec | FixedMapSpec | StreamMapSpec;

export type CameraSpec = CameraMode | { default: CameraMode; allow: CameraMode[] };

export interface PlayerSpec {
  model: string;
  physics: 'ground' | 'air' | 'vehicle';
  radius?: number;
  height?: number;
  speed?: number;
  maxHealth?: number;
}

export interface UnitDef {
  key: string;
  model: string;
  hp?: number;
  static?: boolean;
  behavior?: 'idle' | 'patrol' | 'path' | 'chase' | 'custom';
  path?: string;
  behaviorFn?: unknown;
  spawn?: number;
  placeable?: boolean;
  cost?: number;
}

/** Optional host-provided services (may be partial when engine is headless). */
export interface GameServices {
  physics?: import('../physics/world').PhysicsWorld;
  audio?: import('../engine/audio/AudioEngine').AudioEngine;
  input?: import('../engine/input').Input;
}

/** Context passed to GameSpec.create at boot. */
export interface GameCreateContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Shared quality controller (optional use). */
  quality?: unknown;
  /** DOM parent for the canvas (rarely needed). */
  parent?: HTMLElement;
  /** Engine services when available — prefer these over private instances. */
  services?: GameServices;
  /** The Engine instance — for engine-level services (TimeOfDay, renderer, diag). */
  engine: Engine;
  /**
   * The full three.js engine handle (renderer + scene + camera + moon/hemi +
   * sky groups) — for TimeOfDay and renderer-level access. Optional: headless
   * engines have no GPU canvas.
   */
  three?: RendererEngine;
}

/** What a content package returns from create(). */
export interface GameInstance {
  systems: System[];
  dispose?: () => void;
  /** Optional debug snapshot for probes. */
  stats?: () => Record<string, unknown>;
}

/**
 * GameSpec — content package entry.
 * `create` builds the live instance; host owns loop/present/daylight.
 */
export interface GameSpec {
  id: string;
  title: string;
  camera: CameraSpec;
  /** Apply framework daylight look (for demos; nightraid leaves false). */
  daylight?: boolean;
  /** Keep world.playing true without a match flow (most samples). */
  autoPlay?: boolean;
  map?: MapSpec;
  player?: PlayerSpec;
  units?: UnitDef[];
  config?: Record<string, unknown>;
  i18n?: Record<string, [string, string]>;
  /** Build systems + scene objects. Required for host-mounted games. */
  create?: (ctx: GameCreateContext) => GameInstance;
}
