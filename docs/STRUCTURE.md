# 项目结构（框架主轴）

> 主轴：**框架是产品**。三个样例互不相干，只通过框架 API 接入。
> 本文描述**当前目录**与**目标分层**；迁移步骤见 `EXECUTION_STEPS.md`。

## 顶层

| 路径 | 用途 |
|---|---|
| `src/` | 源代码（见下） |
| `public/` | 静态资产（构建时拷入 dist） |
| `test/` | 单元测试 |
| `scripts/` | 构建 / 测试 / 资产 / 部署脚本 |
| `functions/` | Cloudflare Pages Functions（联机信令） |
| `docs/` | 规划、归档、参考图 |
| `assets_new/` | 第三方模型源资产库（不直接进包） |
| `tools/` | Blender 等本地工具 |
| `index.html` · `vite.config.ts` · `package.json` · `tsconfig.json` · `wrangler.toml` | 工程配置 |
| `FRAMEWORK_PLAN.md` · `EXECUTION_STEPS.md` · `PROGRESS.md` | 框架改造三件套（真相源） |

## `src/` 分层（当前 → 目标）

```
src/
  main.ts                 # 入口：按 ?game= 路由内容包（Phase C）
  config.ts               # 全局配置（Phase B7 注入化后下沉）
  i18n.ts                 # 文案
  engine/                 # L1 内核 ✅ 框架
  physics/                # L1 物理封装（Phase B 并入/注入）
  util/                   # L1 小工具
  net/                    # 联机（Phase B 定为 L2 可选能力）
  ui/                     # 输入/全屏等 L2 候选（fullscreen/touch/gyro）
  world/                  # L2 候选：quality/mapgen/terrain/textures/scale/ballistics
  blocks/                 # L2 积木 ✅ 骨架已建
  content/                # L3 契约 ✅ 骨架已建
  game/
    nightraid/            # Sample A（独立内容包）
    demo-tower/           # Sample B（骨架，Phase D）
    demo-cultivation/     # Sample C（骨架，Phase E）
```

### Sample A `src/game/nightraid/`（已收拢）

| 子路径 | 内容 |
|---|---|
| `game.ts` | 原 `core/game.ts` 大脑（Phase A 逐步拆空） |
| `NightRaidGame.ts` · `systems/` | GameModule 接线 |
| `soldiers/` | 士兵工厂 |
| `ai/` · `player/` · `weapons/` · `audio/` | 玩法实体 |
| `ui/` | 夜袭 HUD / 战术地图 |
| `world/` | 坦克/吉普/油桶/任务/天气等场景内容 |
| `effects.ts` | 特效（Phase B 脱敏后可能上移 L2） |

### 独立性铁律（DoD 验收）

1. `game/<name>/` 两两**禁止互相 import**
2. 样例只 import `engine/` / `blocks/` / `content/`（以及过渡期的 `physics/` `world/` 等）
3. 框架 `engine/`+`blocks/` **不得** import 任一样例
4. 上移 L2 前必须**脱敏**（去掉夜袭专名）

## docs/

| 路径 | 用途 |
|---|---|
| `docs/archive/` | 历史规划（已被 FRAMEWORK_PLAN 取代） |
| `docs/reference/` | 参考截图、素材清单 |
| `docs/compose/` | 历史 compose 规格 |
