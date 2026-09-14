# 15 分钟做出你的第一个 KeeL 3D 游戏

> **硬性要求**：支持 **WebGPU** 的浏览器（Chrome / Edge 新版，Safari 17+）。框架不向后兼容 WebGL。

## 0. 环境（1 分钟）

- Node.js ≥ 22  
- WebGPU 浏览器（打开 `chrome://gpu` 可确认 WebGPU: Hardware accelerated）

## 1. 跑起来（2 分钟）

```bash
git clone https://github.com/lifeidle/keel3d.git
cd keel3d
npm install
npm run build
npm run preview
```

打开 <http://localhost:4173/hub.html> —— 先玩 **Roguelike**（旗舰可通关）或 **collect**（最短上手）。

## 2. 用配方生成你的游戏（2 分钟）

```bash
npm run new-game mygame -- --recipe arpg --title "My ARPG" --html
npm run build && npm run preview
# 打开 /mygame.html
```

可用 `--recipe`：`td` · `arpg` · `collect` · `tps` · `roguelike` · `fps-arena` · `survival` · `platformer` · `tycoon` · `rts-lite` · `stealth` · …

## 3. 只改数据（8 分钟）

打开 `src/game/mygame/index.ts`，把配方参数换成你的：

```ts
import { arpgRecipe } from '../../recipes/arpg';

export default arpgRecipe({
  id: 'mygame',
  title: 'My ARPG',
  arena: 24,
  playerHp: 120,
  attackDamage: 28,
  spawnEvery: 1.8,
});
```

刷新预览。**不要**从零写循环/物理/相机——需要时再 `import` 积木：

```ts
import { Inventory } from '../../blocks/gameplay/Inventory';
import { KitSfx } from '../../blocks/audio/KitSfx';
```

## 4. 钉死规则（2 分钟）

| 规则 | 说明 |
|---|---|
| 入口 | **HTML 文件名** 或 `window.__GAME_ID__`（无 `/?game=`） |
| 分层 | `game/*` 互不 import；`blocks/` 不 import `game/` |
| 按需 | 不用的积木不进包、不进帧循环 |
| 渲染 | **WebGPU-only** |

## 5. 下一步

- 积木清单：[BLOCKS.md](./BLOCKS.md) · API：[API.md](./API.md)  
- 全品类与路线：[GENRE_COVERAGE.md](./GENRE_COVERAGE.md)  
- 作为库：`npm run pack:lib` → `packages/keel3d`

**完成定义**：你能改数值 → 预览变化 → 说出「我的游戏用了哪 3 个积木」。
