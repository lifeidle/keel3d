/**
 * L3 contract — defineGame / GameSpec / UnitDef / MapSpec.
 * Types land progressively; this file is the single content-package API home.
 * See FRAMEWORK_PLAN.md §3.
 */
export type CameraMode = 'fps' | 'chase' | 'orbit' | 'free';

/** Seeded: procedural, same seed → same world. */
export interface SeededMapSpec {
  kind: 'seeded';
  gen: (seed: number) => unknown;
}

/** Fixed: hand-authored map pack (offline bake). */
export interface FixedMapDef {
  id: string;
  /** Human title key or literal. */
  title?: string;
  /** Terrain descriptor — shared shape with seeded gens. */
  terrain: {
    size: number;
    amplitude?: number;
    /** Optional height sampler override. */
  };
  /** Named points of interest (spawn, lanes, tower pads…). */
  pois?: Array<{ id: string; x: number; y?: number; z: number }>;
  /** Spawn definitions for units / players. */
  spawn?: Array<{ id: string; x: number; y?: number; z: number; side?: string }>;
  /** Optional navmesh asset path (future). */
  navmesh?: string;
}

export interface FixedMapSpec {
  kind: 'fixed';
  maps: FixedMapDef[];
}

/** Stream: chunked open world (Sample C). */
export interface StreamMapSpec {
  kind: 'stream';
  root: string;
  chunk: number;
  lodRings: number[];
}

export type MapSpec = SeededMapSpec | FixedMapSpec | StreamMapSpec;

/** Camera: single mode, or multi-mode with a default for runtime switch. */
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

/**
 * GameSpec — the content package entry. `defineGame` (Phase C) turns this
 * into a framework-mountable GameModule.
 */
export interface GameSpec {
  id: string;
  title: string;
  camera: CameraSpec;
  map?: MapSpec;
  player?: PlayerSpec;
  units?: UnitDef[];
  systems?: unknown[];
  config?: Record<string, unknown>;
  i18n?: Record<string, [string, string]>;
}
