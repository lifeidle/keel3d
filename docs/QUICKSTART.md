# Quickstart — 10 分钟上手 KeeL 3D

> **KeeL 3D**（[Specul](https://specul.com)）· npm `keel3d` · https://3d.specul.com  
> 产品是**框架**：内容包互不相干，只通过 L1/L2/L3 API 接入。

## 0. 环境

- Node.js ≥ 22  
- 支持 **WebGPU** 的浏览器（Chrome/Edge 新版，Safari 17+）

## 1. 跑起来

```bash
npm install
npm run build && npm run preview
# 默认 http://localhost:4173
```

| 地址 | 游戏 |
|---|---|
| `/` | FPS 骨架 |
| `/tower.html` | 塔防（1/2/3 选塔，点圆台放置） |
| `/openworld.html` | 开放世界骨架（1/2/3 切视角） |
| `/flight.html` | 飞行骨架 |
| `/race.html` | 赛车骨架 |
| `/template.html` | 空白模板 |

## 2. 理解分层

| 层 | 路径 | 谁写 |
|---|---|---|
| L1 内核 | `src/engine/` | 框架 |
| L2 积木 | `src/blocks/` | 框架 |
| L3 契约 | `src/content/` | 框架 |
| 内容包 | `src/game/<name>/` | **你** |

**铁律**：`game/*` 之间禁止互相 import；`engine/`+`blocks/`+`content/` 禁止 import 任何 `game/`。

## 3. 从模板新建游戏（推荐）

```bash
# 空白模板
npm run new-game mygame -- --title "My Game" --html

# 塔防配方（改 lane/pads/数值即可玩）
npm run new-game mytd -- --recipe td --title "My TD" --html

# 波次生存配方（WASD 移动，撑过波次）
npm run new-game mysurv -- --recipe survival --html
```

会：

1. 生成 `src/game/<id>`  
2. 在 `src/registry.ts` 注册  
3. 可选 `<id>.html` + Vite 多页入口  

打开 `/?game=<id>`。手写方式见 `docs/BLOCKS.md` 与 `src/recipes/tower-defense.ts`。

手写方式（无脚手架）：

```bash
# Windows
xcopy /E /I src\game\demo-template src\game\mygame
```

然后在 `src/registry.ts` 加一行：

```ts
mygame: () => import('./game/mygame'),
```

内容包只需 `export default defineGame({ id, title, create })`。

## 4. 最小 System 模板

```ts
import type { System, EngineWorld } from '../../engine/types';

export const mySim: System = {
  name: 'mygame.sim',
  update(ft: number, world: EngineWorld) {
    if (!world.playing) return;
    // 每帧逻辑
  },
  fixedUpdate(dt: number, world: EngineWorld) {
    if (!world.playing) return;
    // 60Hz 固定步长（物理/AI 建议放这里）
  },
};
```

注册顺序 = 执行顺序。`world.playing === false` 时 `fixedUpdate` 由内核跳过。

## 5. 地图三选一

```ts
import { buildMap, ChunkWorld, createSeededTerrain } from '../../blocks';

// A 程序化（同 seed 同图，适合联机）
buildMap({ kind: 'seeded', gen: (seed) => ({ seed }) },
  { seeded: (seed) => { /* 生成并返回数据 */ } }, { seed: 42 });

// B 手工图包
buildMap({ kind: 'fixed', maps: [{ id: 'a1', terrain: { size: 80 } }] },
  { fixed: (def) => { /* 按 def 搭场景 */ } }, { fixedId: 'a1' });

// C 流式开放世界
const chunks = new ChunkWorld({
  chunkSize: 40,
  ring: 1,
  buildChunk: (cx, cz) => { /* 返回 THREE.Object3D */ },
});
// 每帧：chunks.update(player.x, player.z);
```

## 6. 相机

```ts
const rig = new CameraRig(camera, {
  defaultMode: 'chase',
  chase: { distance: 8, height: 3, lookAhead: 2 },
});
// 每帧
rig.update(dt, targetPos, yaw);
// 运行时切换（开放世界骨架样例用 1/2/3）
rig.setMode('orbit');
```

## 7. L2 积木速查

| 模块 | 用途 |
|---|---|
| `Pool` | 对象池（灯光/特效/敌人） |
| `Path` | 路点跟线 `sampleAt` / `sampleDir` |
| `Steering` | `seekDir` / `flankDir` / `separationDelta` |
| `GridAStar` | 网格寻路 `blockWorld` / `findPath` |
| `CameraRig` | fps/chase/orbit/free + `setMode` |
| `createUnitBody` | 角色胶囊体 |
| `ChunkWorld` | chunk 环加载 |
| `MapBuilder` | seeded / fixed / stream |
| `createSeededTerrain` | 通用地形高度场 |
| `applyDaylight` | 演示用白天光照 |

## 8. 验证你的改动

```bash
npm run typecheck
npm test
npm run build
```

浏览器回归（先 `build` + `preview`，端口按实际改）：

```bash
node scripts/game_regress.mjs http://localhost:4173/
```

## 9. 文档索引

| 文档 | 内容 |
|---|---|
| `README.md` | 框架能做什么、最短路径 |
| `docs/API.md` | L1/L2/L3 契约 |
| `docs/ADAPT.md` | 各品类一页纸 |
| `docs/STRUCTURE.md` | 目录与铁律 |
