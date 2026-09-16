/**
 * Gameplay building blocks barrel — prefer importing specific files
 * (`./gameplay/Health`) so unused modules tree-shake away.
 * Re-exported here for convenience in samples that already bundle all of them.
 */
export { Health, type HealthOpts } from './Health';
export { ObjectiveTracker, type Objective, type ObjectiveSnapshot } from './Objective';
export { Timers } from './Timers';
export { Economy, type EconomyOpts } from './Economy';
export { Scoreboard } from './Scoreboard';
export { WaveDirector, type WaveDef, type WaveDirectorOpts } from './WaveDirector';
export { PlaceGrid, type PlaceGridOpts, type Cell } from './PlaceGrid';
export {
  Spawner,
  type UnitTable,
  type UnitTableRow,
  type SpawnedUnit,
  type SpawnerOpts,
} from './Spawner';
