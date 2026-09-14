# 项目结构（KeeL 3D · 框架主轴 · 终态）

> **产品是框架**。样例互不相干，只通过 L1/L2/L3 API 接入。  
> **品牌**：Specul · **KeeL 3D** · npm `keel3d` · https://3d.specul.com  
> 规划中的二维线：KeeL 2D · `2d.specul.com` · `keel2d`

## 顶层

| 路径 | 用途 |
|---|---|
| `README.md` · `LICENSE` | 说明与许可 |
| `hub.html` | 选型页（游戏形式 → 基底） |
| `index.html` | Sample A 入口（FPS 骨架） |
| `tower.html` | Sample B 独立入口 |
| `cultivation.html` | Sample C 独立入口 |
| `package.json` · `tsconfig.json` · `vite.config.ts` · `wrangler.toml` | 工程配置 |
| `src/` | 源代码 |
| `public/` | 静态资产（音频/模型/Draco/Basis decoder） |
| `test/` | 单元测试（含 blocks） |
| `scripts/` | 验收与构建脚本 |
| `functions/` | Cloudflare Pages 信令 |
| `docs/` | 上手、API、适配、许可 |
| `tools/` | 本地资产转换小脚本 |

## `src/` 分层

```
engine/     L1 内核（WebGPU · 循环 · 输入 · 质量 · 资产 · 音频）
blocks/     L2 积木（Pool Path Steering GridAStar CameraRig Unit
            ChunkWorld MapBuilder scene/* fx/* props/* vehicles/*
            assets/* audio/* combat/* gameplay/* ui/* interact/*
            progress/* build/* kit/*）
content/    L3 契约（GameSpec · defineGame · mountSampleGame host）
registry.ts 组合根：id → 动态 import 内容包（唯一可依赖 game/*）
physics/    物理封装（参数注入）
net/        联机协议（L2 可选能力）
ui/ util/   输入辅助与小工具
world/      L2 候选：quality / mapgen / terrain / textures（FPS 骨架仍用）
game/
  nightraid/           Sample A（完整 FPS + 联机）
  demo-tower/          Sample B 塔防
  demo-cultivation/    Sample C 开放世界骨架
  demo-flight/         飞行骨架
  demo-race/           赛车骨架
  demo-template/       新游戏模板
main.ts               ?game= / window.__GAME_ID__ 路由
```

## 质量门禁说明

- `noUnusedLocals` / `noUnusedParameters` **已开启**（全仓库严格）；未用参数以 _ 前缀。
- **新代码**（blocks / recipes / content）应保持无死代码；审查以 call site 为准。
- CI：typecheck + test + build + bundle:report。

## 体积预算（参考）


npm run bundle:report 后的典型全量 dist ≈ **5.4MB**（含所有骨架入口）。

| 类别 | 量级 | 说明 |
|---|---|---|
| rapier wasm | ~2.0MB | 独立缓存；gzip 后 ~770KB |
| three.js | ~1.0MB | 共享 chunk |
| draco / basis 解码器 | ~1.5MB | 按需加载，不进首屏关键路径 |
| 单骨架 JS | 1–7KB | 配方/tree-shake 后极小 |

**单入口实际首屏**远小于全量：浏览器只拉该 HTML 对应的 chunk + 共享运行时。新积木请保持无顶层副作用，避免被误打进无关入口。

## 积木 import 规则

1. **精确路径**：`import { X } from '../../blocks/gameplay/X'`
2. **禁止** `import * from '../../blocks'` 或 barrel 误拖整包
3. 宿主不自动注册玩法积木；只 push 你 new 出来的 System

## 独立性铁律

1. `game/*` 两两禁止互相 import
2. `engine/` + `blocks/` + `content/` 禁止 import 任何 `game/`
3. 上移 L2 前必须脱敏（去FPS 骨架专名）

## docs/

| 路径 | 用途 |
|---|---|
| `QUICKSTART.md` | 10 分钟上手 |
| `API.md` | 三层契约 |
| `ADAPT.md` | 多品类适配说明 |
| `STRUCTURE.md` | 本文件 |
| `AUDIO_CREDITS.md` · `THIRD_PARTY_NOTICES.md` | 素材许可 |

## scripts/

| 脚本 | 用途 |
|---|---|
| `test.mjs` | 单测（46） |
| `snapshot.mjs` | 步骤快照 save/restore |
| `game_regress.mjs` · `game_state_check.mjs` · `game_probe.mjs` · `selfcheck_full.mjs` | 浏览器回归 |
| `net_e2e.mjs` | 联机 e2e |
| `assets-encode.mjs` · `assets-webp.mjs` | 资产管线 |
| `new-game.mjs` | 内容包脚手架（`npm run new-game`） |
| `probe-all.mjs` | 全骨架浏览器探针 |
| `bundle-report.mjs` | dist 体积报告 |
| `unused-check.mjs` | blocks 未引用报告（信息性） |
| `site-audit.mjs` | 站点体检 |
| `adapter_probe.mjs` · `buf_err_probe.mjs` · `webgpu_probe.mjs` | 诊断 |

## 本地演示

| URL | 游戏 |
|---|---|
| http://localhost:4188/ | FPS 骨架 |
| http://localhost:4189/tower.html | 塔防 |
| http://localhost:4190/openworld.html | 开放世界骨架 |
| `/flight.html` · `/race.html` · `/template.html` | 骨架/模板 |

## 不入库 / 可再生

`node_modules/` · `dist/` · `shots/` · `_snapshots/` · `.tmp/` · `.wrangler/` · `assets_new/`（已清理）
