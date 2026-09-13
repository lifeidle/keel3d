# Quickstart — 10 分钟上手框架

> 产品是**框架**：三个样例互不相干，只通过框架 API 接入。

## 跑起来

```bash
npm install
npm run dev          # 默认 Sample A 夜袭
# 或
npm run build && npm run preview
# 然后打开：
#   /?game=nightraid      FPS（默认）
#   /?game=tower          塔防（1/2/3 选塔，点塔位放置）
#   /?game=cultivation    修仙（1/2/3 切视角）
```

需要 **WebGPU** 浏览器（Chrome/Edge 新版，Safari 17+）。无 WebGPU 会显示明确错误页。

## 分层

| 层 | 路径 | 谁写 |
|---|---|---|
| L1 内核 | `src/engine/` | 框架 |
| L2 积木 | `src/blocks/` | 框架 |
| L3 契约 | `src/content/` | 框架 |
| 内容包 | `src/game/<name>/` | 你 |

**铁律**：`game/*` 之间禁止互相 import；`engine/`+`blocks/` 禁止 import 任何 `game/`。

## 写一个新游戏

```ts
// src/game/mygame/index.ts
import { defineGame } from '../../content/defineGame';
import { CameraRig, Path, ChunkWorld, Steering } from '../../blocks';

export const mygame = defineGame({
  id: 'mygame',
  title: 'My Game',
  camera: { default: 'chase', allow: ['fps', 'chase', 'orbit'] },
  map: { kind: 'seeded', gen: (seed) => ({ /* your terrain */ }) },
  // 或 fixed / stream
});
```

在 `src/main.ts` 的 `?game=` 路由里加一行加载逻辑（参考 tower / cultivation）。

## L2 积木速查

| 模块 | 用途 |
|---|---|
| `Pool` | 对象池（灯光/特效/敌人） |
| `Path` | 路点跟线 |
| `Steering` | 纯函数转向（seek/flank/separation） |
| `GridAStar` | 网格寻路（可选） |
| `CameraRig` | fps/chase/orbit/free + 运行时 `setMode` |
| `Unit` | 角色胶囊体工厂 |
| `ChunkWorld` | chunk 环加载/卸载 |
| `MapBuilder` | seeded / fixed / stream 分发 |

## 验证

```bash
npm run typecheck
npm test                 # 26 项（含 blocks）
npm run build
node scripts/game_regress.mjs http://localhost:4188/
node scripts/sample_probe.mjs
```

## 文档

- `FRAMEWORK_PLAN.md` — 架构与验收标准
- `EXECUTION_STEPS.md` — 分步施工单
- `PROGRESS.md` — 进度真相源
- `docs/STRUCTURE.md` — 目录说明
