/**
 * Sample B — demo-tower. Thin wrapper around the td recipe so tower.html
 * and `new-game --recipe td` share one implementation.
 */
import { towerDefenseRecipe } from '../../recipes/tower-defense';

export default towerDefenseRecipe({
  id: 'tower',
  title: 'Tower Defense Skeleton',
  lane: [
    { x: -24, y: 0, z: 0 },
    { x: -10, y: 0, z: 5 },
    { x: 2, y: 0, z: -5 },
    { x: 14, y: 0, z: 3 },
    { x: 24, y: 0, z: 0 },
  ],
  pads: [
    { x: -6, z: 8 },
    { x: 4, z: -8 },
    { x: 12, z: 6 },
    { x: -2, z: -10 },
    { x: 18, z: -4 },
  ],
  startMoney: 120,
  baseHp: 20,
});
