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
