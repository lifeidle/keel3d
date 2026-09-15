/**
 * Sample B — demo-tower. Thin wrapper around the td recipe so tower.html
 * and `new-game --recipe td` share one implementation.
 *
 * Campaign mode: three maps in a row (S-curve → double-S → serpentine).
 * Clear all waves to advance; towers are sold back at 50% and money is kept;
 * enemy HP scales up per map. Winning the last map wins the campaign.
 */
import { towerDefenseRecipe } from '../../recipes/tower-defense';

export default towerDefenseRecipe({
  id: 'tower',
  title: 'Tower Defense Skeleton',
  startMoney: 120,
  baseHp: 20,
  maps: [
    {
      name: 'S 弯',
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
    },
    {
      name: '双 S',
      lane: [
        { x: -25, y: 0, z: -16 },
        { x: -25, y: 0, z: 16 },
        { x: 25, y: 0, z: 16 },
        { x: 25, y: 0, z: -16 },
      ],
      pads: [
        { x: -12, z: 9 },
        { x: 0, z: 9 },
        { x: 12, z: 9 },
        { x: -12, z: -9 },
        { x: 0, z: -9 },
        { x: 18, z: -5 },
      ],
    },
    {
      name: '蛇形',
      lane: [
        { x: -25, y: 0, z: -18 },
        { x: -8, y: 0, z: -18 },
        { x: -8, y: 0, z: 12 },
        { x: 14, y: 0, z: 12 },
        { x: 14, y: 0, z: -8 },
        { x: 25, y: 0, z: -8 },
      ],
      pads: [
        { x: -17, z: -10 },
        { x: 0, z: -8 },
        { x: -2, z: 4 },
        { x: 6, z: 2 },
        { x: 19, z: 1 },
      ],
    },
  ],
});
