/**
 * Recipes — thin data-driven game factories.
 * Copy a recipe into your game folder, or import and call with your data.
 * Not auto-registered; nothing here runs unless you use it.
 */
export {
  towerDefenseRecipe,
  createTowerDefenseGame,
  type TowerDefenseRecipeOpts,
  type TdTowerDef,
} from './tower-defense';
export {
  survivalRecipe,
  createSurvivalGame,
  type SurvivalRecipeOpts,
} from './survival';
export {
  arpgRecipe,
  createArpgGame,
  type ArpgRecipeOpts,
} from './arpg';
export {
  collectRecipe,
  createCollectGame,
  type CollectRecipeOpts,
} from './collect';
export {
  rallyRecipe,
  createRallyGame,
  type RallyRecipeOpts,
} from './rally';
export {
  dungeonRecipe,
  createDungeonGame,
  type DungeonRecipeOpts,
} from './dungeon';
export {
  flightArenaRecipe,
  createFlightArena,
  type FlightArenaOpts,
} from './flight-arena';
export {
  fpsArenaRecipe,
  createFpsArena,
  type FpsArenaOpts,
} from './fps-arena';
export {
  tpsRecipe,
  createTpsGame,
  type TpsRecipeOpts,
} from './tps';
export {
  roguelikeRecipe,
  createRoguelikeGame,
  type RoguelikeRecipeOpts,
} from './roguelike';

export { platformerRecipe, createPlatformerGame, type PlatformerRecipeOpts } from './platformer';
export { tycoonRecipe, createTycoonGame, type TycoonRecipeOpts } from './tycoon';
export { rtsLiteRecipe, createRtsLiteGame, type RtsLiteRecipeOpts } from './rts-lite';
export { stealthRecipe, createStealthGame, type StealthRecipeOpts } from './stealth';
export { combatArenaRecipe, createCombatArenaGame, type CombatArenaRecipeOpts } from './combat-arena';