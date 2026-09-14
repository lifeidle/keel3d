# KeeL 3D

> **English:** [README.en.md](README.en.md) · [User Guide (EN)](docs/USER_GUIDE.en.md) · [Legal (EN)](docs/LEGAL.en.md)

> **品牌**：[Specul](https://specul.com) · **KeeL 3D**  
> **仓库**：https://github.com/lifeidle/keel3d · **npm**：`keel3d`  
> 规划：KeeL 2D · `keel2d`

**纯浏览器 3D 游戏基座**（WebGPU + three.js + Rapier + TypeScript）。

不用从渲染循环、刚体世界、对象池、相机机架搭起——clone 后只填「模型 + 玩法 + 场景」，即可做出各类网页 3D 游戏。

| | |
|---|---|
| 渲染 | **WebGPU 唯一**（three.js，无 WebGL 回退） |
| 物理 | Rapier3D |
| 语言/构建 | TypeScript + Vite |
| 许可 | MIT（代码）· 素材见第三方声明 |

> 需要支持 WebGPU 的浏览器（Chrome / Edge 新版，Safari 17+）。

---

## 骨架一览（独立 HTML 入口）

| 骨架 | 入口 | 说明 |
|---|---|---|
| **FPS 骨架** | [`fps.html`](fps.html) | 完整第一人称演示（高级） |
| **FPS 竞技场** | [`fps-arena.html`](fps-arena.html) | 轻量 FPS 起点 · 血条/飘字/结算 |
| **塔防骨架** | [`tower.html`](tower.html) | fixed 路线 · 放塔升级 · 波次/经济 |
| **开放世界骨架** | [`openworld.html`](openworld.html) | stream · 1/2/3 切视角 |
| **俯视 ARPG** | [`arpg.html`](arpg.html) | 近战/弹道/旋风斩 · 任务/掉落 |
| **收集骨架** | [`collect.html`](collect.html) | 拾取交付 · 参考时间 · 局内统计 |
| **地牢骨架** | [`dungeon.html`](dungeon.html) | 房间门锁 · Boss · 小地图 |
| **拉力赛骨架** | [`rally.html`](rally.html) | 检查点顺序 · 最佳圈速 |
| **飞行骨架** | [`flight.html`](flight.html) | chase · gravity 0 |
| **飞行竞技场** | [`flight-arena.html`](flight-arena.html) | 空战配方起点 |
| **赛车骨架** | [`race.html`](race.html) | 赛道环线 · vehicle |
| **空白模板** | [`template.html`](template.html) | 最少代码起点 |
| **选型页** | [`hub.html`](hub.html) | 骨架 → 基底与积木说明 |

入口一律用 **HTML 文件**，不用查询参数。

---

## 作为库使用（npm）

`ash
npm run pack:lib   # 生成 packages/keel3d（src + d.ts + package.json）
`

\\\	s
import { defineGame, CharacterController, Arsenal, KitSfx } from 'keel3d';
\\\

peerDependencies：\	hree\ · \@dimforge/rapier3d\。根仓库保持 \private\；发布在 \packages/keel3d\ 执行 \
pm publish\（需用户侧 2FA）。

## 本地开发

```bash
npm install
npm run build
npm run preview
# 打开 /hub.html 或各骨架 html
```

新建游戏：

```bash
npm run new-game mygame -- --title "My Game" --html
npm run new-game mytd -- --recipe td --html
```

---

## 品类一览（20+）

FPS · TPS · 塔防 · 生存 · ARPG · 收集 · 地牢 · 拉力 · 竞速 · 飞行 · 空战 · 开放世界 · Roguelike · 平台 · 城建 · RTS-lite · 潜行 · 载具对战 · 音游 · 体素沙盒 · BR-lite · 物理益智 · 体育

完整缺口与路线见 [docs/GENRE_COVERAGE.md](docs/GENRE_COVERAGE.md)。配方音效为**自研 Kit**（
pm run sfx:gen）。

## 你能用它做什么

| 框架已提供 | 你负责 |
|---|---|
| 循环 / 物理 / 输入 / 画质档 | 题材与美术 |
| Pool · Path · Steering · GridAStar | 数值表 |
| CameraRig（可运行时切换） | 0–3 个专属 System |
| ChunkWorld · MapBuilder（seeded/fixed/stream） | |
| 玩法积木：Health · Wave · Economy · PlaceGrid… | |
| UI 积木：HudPanel · Toast · EndOverlay · HealthBar | |

**按需 import**：不用的积木不进包、不进帧循环。

---

## 复制配方 vs 读完整样例

- **改玩法**：复制 `src/recipes/*.ts` 或 `new-game --recipe` 生成的包，改数据与少量 System。  
- **学接线**：读 `src/game/nightraid`（完整 FPS 演示），不要整包拷贝。  
- **只用积木**：精确路径 import `src/blocks/...`，避免 barrel 误拖。

## 架构

```
src/engine/     L1 内核
src/blocks/     L2 积木
src/content/    L3 契约（defineGame / host）
src/registry.ts 组合根（加载 game/*）
src/game/*      内容包（互不 import）
```

---

## 文档

- [使用指南](docs/USER_GUIDE.md) · [配方](docs/RECIPES.md) · [Quickstart](docs/QUICKSTART.md)  
- [API](docs/API.md) · [积木](docs/BLOCKS.md) · [目录](docs/STRUCTURE.md)  
- [法律与商用](docs/LEGAL.md) · [第三方版权](docs/THIRD_PARTY_NOTICES.md)  

---

## 质量

```bash
npm run typecheck
npm test
npm run build
```

---

## 许可

- **源代码**：MIT（见 `LICENSE`）— 可商用，保留版权声明  
- **`public/` 素材**：CC0 / CC-BY 等，**不在 MIT 范围内**（见 notices）  
- 完整构建若含 CC-BY 素材，须按 [THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) 署名  

---

## 部署

```bash
npm run build
# 将 dist/ 放到任意静态托管
```

联机信令（可选）见 `functions/` 与 `wrangler.toml`（KV id 请填你自己的）。
