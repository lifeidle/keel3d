/**
 * L2 blocks — generic building blocks shared by all games.
 *
 * Rules (framework independence):
 * - blocks MUST NOT import from src/game/ or any sample content.
 * - content packages MAY import blocks.
 * - anything with a night-raid / tank / soldier name stays in the sample.
 */
export { Pool } from './Pool';
export { Path } from './Path';
export * as Steering from './Steering';
export { CameraRig, type CameraMode } from './CameraRig';
export { createUnitBody, type UnitBodyOpts, type UnitBody } from './Unit';
export { ChunkWorld, type ChunkWorldOpts, type ChunkCoord } from './ChunkWorld';
export { buildMap, type MapBuilderDeps, type BuiltMap } from './MapBuilder';
export { GridAStar, type GridAStarOpts } from './GridAStar';
export {
  createSeededTerrain,
  createDomeTerrain,
  domeHeightField,
  type TerrainOpts,
  type SeededTerrain,
  type DomeSpec,
  type RippleSpec,
  type DomeTerrainOpts,
  type TerrainAssemblyOpts,
} from './scene';
export { applyDaylight, addSunDisc } from './scene';
