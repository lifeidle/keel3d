/**
 * 游戏入口 —— 这就是你要改的地方。
 *
 * 换配方：把 `arpgRecipe` 换成 `keel3d/recipes` 里的任意一个
 *   （td · survival · arpg · collect · rally · dungeon · fps-arena · tps ·
 *     flight-arena · roguelike · platformer · tycoon · rts-lite · stealth ·
 *     combat-arena · rhythm · sandbox · br-lite · puzzle · sports）
 * 改数值：给配方传参数，见 https://github.com/lifeidle/keel3d/blob/master/docs/RECIPES.md
 *
 * 需要更自由时：直接用 `defineGame` + `keel3d` 导出的积木自己写 System。
 */
import { arpgRecipe } from 'keel3d/recipes';

export default arpgRecipe({
  id: 'my-game',
  title: 'My Game',
});
