# 项目结构（框架主轴 · 终态）

> **产品是框架**。样例互不相干，只通过 L1/L2/L3 API 接入。

## 顶层

| 路径 | 用途 |
|---|---|
| `FRAMEWORK_PLAN.md` | 战略规划（真相源） |
| `EXECUTION_STEPS.md` | 分步施工单 |
| `PROGRESS.md` | 进度真相源 |
| `README.md` · `LICENSE` | 说明与许可 |
| `index.html` | Sample A 入口（夜袭） |
| `tower.html` | Sample B 独立入口 |
| `cultivation.html` | Sample C 独立入口 |
| `package.json` · `tsconfig.json` · `vite.config.ts` · `wrangler.toml` | 工程配置 |
| `src/` | 源代码 |
| `public/` | 静态资产（音频/模型/Draco/Basis decoder） |
| `test/` | 单元测试（含 blocks） |
| `scripts/` | 验收与构建脚本 |
| `scripts/legacy/` | 一次性调参/探针（不进主流程） |
| `functions/` | Cloudflare Pages 信令 |
| `docs/` | 上手与归档 |
| `assets_new/` | 第三方模型源库（gitignore） |
| `tools/` | Blender 等本地工具 |

## `src/` 分层

```
engine/     L1 内核（WebGPU · 循环 · 输入 · 质量 · 资产 · 音频）
blocks/     L2 积木（Pool Path Steering GridAStar CameraRig Unit
            ChunkWorld MapBuilder scene/*）
content/    L3 契约（GameSpec · MapSpec · defineGame）
physics/    物理封装（参数注入）
net/        联机协议（L2 可选能力）
ui/ util/   输入辅助与小工具
world/      L2 候选：quality / mapgen / terrain / textures（夜袭仍用）
game/
  nightraid/           Sample A（完整 FPS + 联机）
  demo-tower/          Sample B 塔防
  demo-cultivation/    Sample C 修仙
  demo-flight/         飞行骨架
  demo-race/           赛车骨架
  demo-template/       新游戏模板
main.ts               ?game= / window.__GAME_ID__ 路由
```

## 独立性铁律

1. `game/*` 两两禁止互相 import
2. `engine/` + `blocks/` + `content/` 禁止 import 任何 `game/`
3. 上移 L2 前必须脱敏（去夜袭专名）

## docs/

| 路径 | 用途 |
|---|---|
| `QUICKSTART.md` | 10 分钟上手 |
| `API.md` | 三层契约 |
| `ADAPT.md` | 多品类适配说明 |
| `STRUCTURE.md` | 本文件 |
| `AUDIO_CREDITS.md` · `THIRD_PARTY_NOTICES.md` | 素材许可 |
| `archive/` | 历史规划与 compose 规格 |
| `reference/` | 参考截图 |

## scripts/（主流程）

| 脚本 | 用途 |
|---|---|
| `test.mjs` | 单测（26） |
| `snapshot.mjs` | 步骤快照 save/restore |
| `game_regress.mjs` · `game_state_check.mjs` · `game_probe.mjs` · `selfcheck_full.mjs` | 浏览器回归 |
| `net_e2e.mjs` | 联机 e2e |
| `assets-encode.mjs` · `assets-webp.mjs` | 资产管线 |
| `site-audit.mjs` | 站点体检 |
| `adapter_probe.mjs` · `buf_err_probe.mjs` · `webgpu_probe.mjs` | 诊断 |

## 本地演示端口

| URL | 游戏 |
|---|---|
| http://localhost:4188/ | 夜袭 |
| http://localhost:4189/tower.html | 塔防 |
| http://localhost:4190/cultivation.html | 修仙 |
| `/?game=flight` · `/?game=race` · `/?game=template` | 骨架/模板 |
