/**
 * scaffolds.mjs — `npm run new-game` 生成内容包时用的示例代码片段。
 *
 * 没有条目的配方一律走通用三行包装，因此**新增配方不需要改 new-game.mjs**
 * （方案见 docs/CATALOG.md「新增一个品类的正确姿势」）。
 * 这里只保留少数几个值得给出「可直接改的数据」的配方示例。
 */

/** @type {Record<string, (id: string, title: string) => string>} */
export const RECIPE_SCAFFOLDS = {
  td: (id, title) => `/**
 * \`${id}\` — 塔防（改下面的数据即可）。
 * 生成命令：npm run new-game ${id} -- --recipe td
 */
import { towerDefenseRecipe } from '../../recipes/tower-defense';

export default towerDefenseRecipe({
  id: '${id}',
  title: '${title}',
  // 敌人路线折线
  lane: [
    { x: -24, y: 0, z: 0 },
    { x: -10, y: 0, z: 5 },
    { x: 2, y: 0, z: -5 },
    { x: 14, y: 0, z: 3 },
    { x: 24, y: 0, z: 0 },
  ],
  // 可放塔的圆台中心
  pads: [
    { x: -6, z: 8 },
    { x: 4, z: -8 },
    { x: 12, z: 6 },
  ],
  startMoney: 120,
  baseHp: 20,
  // towers / waves 省略则用默认表
});
`,

  survival: (id, title) => `/**
 * \`${id}\` — 波次生存（WASD 移动，撑过波次）。
 * 生成命令：npm run new-game ${id} -- --recipe survival
 */
import { survivalRecipe } from '../../recipes/survival';

export default survivalRecipe({
  id: '${id}',
  title: '${title}',
  playerHp: 100,
  // waves / enemyHp / enemySpeed 省略则用默认表
});
`,

  race: (id, title) => `/**
 * \`${id}\` — 赛车（环线自动巡航 · 圈速/最佳圈）。
 * 生成命令：npm run new-game ${id} -- --recipe race
 */
import { raceRecipe } from '../../recipes/race';

export default raceRecipe({
  id: '${id}',
  title: '${title}',
  // 环线折线（首尾相接）；省略则用默认 ~137m 矩形环
  track: [
    { x: -20, y: 0, z: -12 },
    { x: 20, y: 0, z: -12 },
    { x: 24, y: 0, z: 12 },
    { x: -24, y: 0, z: 12 },
    { x: -20, y: 0, z: -12 },
  ],
  speed: 12,
  // lapsToWin: 0 = 无尽计时；saveKey 省略则存 keel3d-race-best
});
`,
};

/**
 * 通用包装：配方导出名与文件名都从 catalog 读取，不再硬编码分支。
 * @param {{slug:string, export:string, file:string}} recipe
 */
export function genericScaffold(recipe, id, title) {
  return `/**
 * \`${id}\` — 基于 \`${recipe.slug}\` 配方的内容包。
 * 生成命令：npm run new-game ${id} -- --recipe ${recipe.slug}
 * 参数说明见 docs/RECIPES.md
 */
import { ${recipe.export} } from '../../recipes/${recipe.file}';

export default ${recipe.export}({
  id: '${id}',
  title: '${title}',
});
`;
}

/** 取该配方的脚手架代码：优先专用示例，否则通用包装。 */
export function scaffoldFor(recipe, id, title) {
  const special = RECIPE_SCAFFOLDS[recipe.slug];
  return special ? special(id, title) : genericScaffold(recipe, id, title);
}
