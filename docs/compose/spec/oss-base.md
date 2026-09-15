---
feature: oss-base
status: in-progress
updated: 2026-09-15
owner: Specul / KeeL 3D authors
scope: 把 KeeL 3D 从「可 fork 的仓库」变成「可直接搭建游戏的基座」，并让演示站自动同步
---

# OSS Base — 从「可 fork 的仓库」到「可直接搭建的基座」

> 本文是**施工计划**，不是结项报告。每一阶段（P0–P6）都以「可独立验收、可独立上线」为粒度切分。
> 验收门禁沿用 `docs/GENRE_COVERAGE.md §10`：`typecheck` · `test` · `build` · `probe-all` · `unused:check` 不回归。

## 进度

| 阶段 | 状态 | 交付 | 验收 |
|---|---|---|---|
| **P0** 单一真相源 | ✅ **完成** | `src/catalog/`（24 品类 + 20 配方）+ `scripts/catalog-{lib,gen,check}.mjs` + `scripts/scaffolds.mjs`；`new-game` 改为数据驱动 | `catalog:check` 零漂移 · typecheck ✓ · test 88/88 ✓ · build ✓ · **probe-all 25/25 ✓** |
| **P5** 剩余两条品类 | ⏳ 下一步 | 卡牌/桌游 3D · 银河恶魔城（走新的 1 处改动流程） | 两条配方 + 单测 + 配方页 + probe + hub 卡片 |
| **P1** 仓库外基座 | ⏳ | 配方进公共 API + `templates/starter` + `examples/` + `create-keel3d` | 仓库外空目录 5 分钟可玩 |
| **P2** npm 门面 | ⏳（不发布） | 包 README 重写 + homepage/keywords/0.4.0 + CHANGELOG | `npm pack` 内容正确，只差一条 publish 命令 |
| **P3** 演示站升级 | ⏳ | hub 缩略图 + 「从零开始」区块 + RECIPES/矩阵回填 | `catalog:check` + 站点探针 |
| **P4/P6** 收口 | ⏳ | `unused:check` / `license-check` / 治理文件 | 全门禁绿 |

**P0 实际效果（已实测）**
- 品类同步点从 **9 处手工 → 1 处**（`src/catalog/catalog.json`）；
- 演示站三套数字首次一致：**hub 24 卡片 == registry 24 注册 == vite 26 入口**；
- 修掉了两处真实漂移：`fps.html`（完整战役）与 `flight-arena.html` 此前**未出现在展示台**，现已自动补上；
- 顺带修掉一个潜在 bug：带连字符的 id（如 `my-game`）在 registry 里曾是非法键，现在自动加引号。

---

## 0. 结论摘要

**体检结论：框架本体已经成熟，卡点不在"功能不够"，而在"用户拿不到、用不上、对不齐"。**

| 维度 | 现状 | 判断 |
|---|---|---|
| 引擎 / 积木 / 契约 | L1 内核 + ~90 个 L2 积木 + L3 `defineGame` 契约，分层严格 | ✅ 成熟 |
| 品类覆盖 | 19 个配方（td/survival/arpg/collect/rally/dungeon/fps-arena/tps/flight-arena/roguelike/platformer/tycoon/rts-lite/stealth/combat-arena/rhythm/sandbox/br-lite/puzzle/sports）+ nightraid 完整战役 | ✅ 超预期 |
| 质量门禁 | 实测 `typecheck` 通过 · `test` **88/88 通过** · `build` 通过 · CI 跑 `probe-all` **25 页** | ✅ 健康 |
| 文档 | 16 篇对外文档 + 8 篇内部规格；`RECIPES.md` 19 条配方含参数/操作/胜负 | ✅ 完备 |
| npm | `keel3d@0.3.0` **已发布**（388 文件 / 1.17MB） | 🔶 半成品门面 |
| **仓库外可用** | **无任何外部工程路径** | ❌ **最大缺口** |
| **配方可用性** | 包内配方**只有未编译 TS**，公共 API 不导出 | ❌ **主线半通** |
| **演示站同步** | hub 品类清单**手工硬编码在 HTML 里** | ❌ **必然漂移** |

**一句话**：现在用户要做游戏，唯一路径是 **fork 整个仓库**（9000+ 文件），在 `src/game/` 里写代码。
"以它为基座"目前等于"接管它的仓库"。这正是本计划要解决的问题。

---

## 1. 现状事实基线（实测证据）

| 事实 | 证据 |
|---|---|
| 19 配方 + 24 注册游戏 + 26 个 HTML 入口 | `src/recipes/*`（19 个）、`src/registry.ts`（24 条）、`vite.config.ts`（26 输入）、根目录 26 个 `*.html` |
| 24 个 demo 中 19 个是**配方瘦包装** | `src/game/demo-*/index.ts` 多为 120–160 字节，如 `demo-arpg` 仅 3 行 |
| 4 个手写 demo + 1 个旗舰 | `demo-cultivation`(9.3KB)、`demo-flight`(2.8KB)、`demo-race`(4.2KB)、`demo-template`(2.3KB)、`demo-tower`(0.6KB)、`nightraid/`(game.ts 83KB + enemy.ts 60KB) |
| 测试 88 个全绿 | `npm test` → `pass 88 / fail 0`（821ms，esbuild 打包 20 个测试文件后跑 node test runner） |
| CI 全链路 | `.github/workflows/ci.yml`：`npm ci` → typecheck → test → build → bundle:report → Playwright → `vite preview` → `probe-all` |
| probe 覆盖 25 页且每页有专属选择器 | `scripts/probe-all.mjs` pages 数组（`#td-hud` / `#rogue-hud` / `#arena-hud` …） |
| npm 已发布 | registry `keel3d` latest = `0.3.0`（2026-09-14），`exports: {".": dist/lib.js, "./src/*": "./src/*"}` |
| **包内无编译后的配方** | `glob packages/keel3d/dist/recipes/**` → **No files found**；`tsconfig.lib.json` 的 `include` 只有 `src/lib.ts` |
| **lib.ts 不导出配方** | `src/lib.ts` 导出 blocks/content/engine，19 个 recipe **一个都没有** |
| 工作树干净 / 忽略规则完备 | `git status` 0 条；`.gitignore` 含 `dist/`、`dist_old*/`、`qa-*/`、`.worktrees/`、`packages/keel3d/{dist,src}` |
| 无外部工程化设施 | grep `create-keel3d` / `npm create` / `starter` / `vite-plugin` → **仅 1 处无关注释** |

---

## 2. 差距分析

### G1 —「基座」不成立：没有仓库外工程路径 【P0，最高价值】
- 现状：`npm run new-game <id>` **在仓库内**生成 `src/game/<id>`，并改写 `src/registry.ts`。
- 用户视角：想做一个自己的游戏，必须先 clone 9000+ 文件、装 30+ devDependency 的仓库。
- 影响：这是"以它为基座"的**唯一硬阻塞**；npm 包再全，用户也没有接得上的入口。

### G2 — 配方不在包的公共 API 里 【P0】
- `lib.ts` 不导出配方 → `tsconfig.lib.json` 只编译 `lib.ts` → `dist/` 里**没有 recipes**。
- 用户只能 `import { arpgRecipe } from 'keel3d/src/recipes/arpg'`，拿到的是**未编译 TS**。
- 影响：宿主要求"能转译 node_modules 里的 TS"才能用——Vite 默认不做，等于**主推卖点（选配方出游戏）在包外不可用**。

### G3 — 同一份品类清单被手工维护 6–8 处 【P0，演示站漂移根因】
新增一个配方，需要**手改**：
1. `src/recipes/<slug>.ts`（新文件）
2. `<slug>.html`（HTML 入口）
3. `vite.config.ts`（多页 input）
4. `src/registry.ts`（`GAME_LOADERS`）
5. `hub.html` 的 `GENRES` 数组（22 条，内嵌在 `<script>`）
6. `scripts/probe-all.mjs` 的 pages 数组（25 条）
7. `docs/RECIPES.md`（配方表 + 胜负表，**两张表**）
8. `docs/GENRE_COVERAGE.md §1` 矩阵
9. `scripts/new-game.mjs` 的 `if (recipe === 'td') … else if` **硬编码分支链**

→ 9 处手工同步点。**漂移不是可能性，是必然**，且已发生（见 G4）。

### G4 — 演示站已经存在漂移 【P0】
- `fps.html`（完整战役）**未作为 hub 卡片出现**，只在 fps-arena 的 note 文字里被提及。
- `flight-arena.html` **完全未被 hub 列出**（孤儿页）。
- hub 的 22 条与 registry 的 24 条、vite 的 26 个入口**三套数字对不上**。

### G5 — npm 门面薄弱 【P1】
- 包内 `README.md` 由 `scripts/build-lib.mjs` 生成，**仅 15 行**：一个 import 示例 + peer deps + GitHub 链接。
- **不链演示站** `keel.specul.com/3d/hub.html`（最有说服力的资产）；不列配方；无 5 分钟上手；无截图。
- `homepage` 指向 GitHub 而非演示站（0.0.1 曾指向已废弃的 `3d.specul.com`）。

### G6 — 文档滞后于代码 【P1】
- `docs/GENRE_COVERAGE.md §1` 矩阵仍写着 Roguelike/平台/潜行/体育/体素/音游 = ❌，但**这些配方都已存在**。该文档的 R0–R7 已基本落地，矩阵未回填。
- 三份品类清单（hub GENRES / RECIPES.md / GENRE_COVERAGE §1）互不校验。

### G7 — 剩余品类（低优先，可选） 【P3】
- 矩阵中仅剩 2 行 ❌：**卡牌/桌游 3D**、**银河恶魔城**；原文均标注"可后置"。
- 结论：应显式决策「做」或「写入 Out of Scope 并标记永不做」，而不是长期挂着 ❌。

### G8 — 工程卫生（小） 【P2】
- 工作区残留 3 个 `dist_old_*` 目录（已被 gitignore，仅占磁盘）。
- `new-game.mjs` 的配方分支是 if/else 链（应数据化，见 P0）。
- 无 `license-check` 脚本（GENRE_COVERAGE §7.6 曾建议）。

---

## 3. 目标与非目标

### 目标（对应本次需求三句话）
1. **彻底完善为游戏底层框架** → 收口 DoD、消除文档滞后、把 9 处手工同步点收敛为 1 处。
2. **用户可直接以它为基座搭建游戏** → 提供仓库外 5 分钟路径（`npm create keel3d` + `npm i keel3d`）。
3. **演示网页同步更新** → hub 由单一真相源**生成**，并纳入 CI 防漂移校验。

### 非目标（本轮明确不做）
- 不重写 nightraid、不做引擎架构重构、不引入新渲染后端（保持 WebGPU-only）。
- 不 vendoring 任何第三方玩法代码（沿用 MIT 自研纪律）。
- 不追求"支持全部 24 品类"——按 §8 取舍。

---

## 4. 路线图 P0–P6

> 依赖顺序：`P0 → P1 → P2 → P3`，`P4` 可与 P1/P2 并行，`P5`/`P6` 收尾。

### P0 — 单一真相源：品类目录（Catalog） 【0.5–1 天】
**目标**：把 9 处手工同步点收敛成「一份 catalog + 生成器 + 校验器」。

**交付物**
| 文件 | 作用 |
|---|---|
| `src/catalog/types.ts` | `GenreCard` 接口（schema 见 §5） |
| `src/catalog/index.ts` | **唯一真相源**：22–26 条品类元数据（id/title/blurb/tags/demo/spec/cmd/note/blocks/thumb/status） |
| `scripts/catalog-gen.mjs` | 从 catalog 生成：`hub.html` 的 `GENRES` 段、`docs/RECIPES.md` 两张表、`scripts/probe-all.mjs` 的 pages 数组、`vite.config.ts` 的 input、`src/registry.ts` 的 loaders |
| `scripts/catalog-check.mjs` | 校验 catalog ↔ 实际页面/注册表/probe **零漂移**，出口码非 0 即失败（进 CI） |

**关键决策**：`hub.html` 改为**注入式生成区**（`<!-- CATALOG:BEGIN --> … <!-- CATALOG:END -->`），生成器只改这两行之间，其余手写内容（首屏、说明、页脚）不动。

**演示站同步**：本阶段直接消灭 G3/G4 —— 生成后 hub 自动补上 `fps`、`flight-arena`，三套数字自动一致。

**验收**
```bash
node scripts/catalog-gen.mjs && node scripts/catalog-check.mjs   # 0 漂移
npm run typecheck && npm test && npm run build && node scripts/probe-all.mjs
```
**风险**：`hub.html` 是手写大文件（793 行），注入区必须精确定位，先备份、后 diff 验证。

---

### P1 — 仓库外基座（本次最高价值） 【2–3 天】
**目标**：用户不 clone 仓库，也能 5 分钟做出一个跑得起来的游戏。

**交付物**

1. **把配方纳入包的公共 API**
   - `src/lib.ts` 增加 `export * as recipes from './recipes'`（或逐条具名导出 19 个）。
   - `tsconfig.lib.json` 的 `include` 增加 `src/recipes/**`（或改为 `["src/lib.ts","src/recipes/**/*.ts"]`），使 `dist/recipes/**` 真正产出 `.js + .d.ts`。
   - `packages/keel3d/package.json` 增加子路径导出：
     ```json
     "exports": {
       ".": { "types": "./dist/lib.d.ts", "import": "./dist/lib.js" },
       "./recipes": { "types": "./dist/recipes/index.d.ts", "import": "./dist/recipes/index.js" },
       "./blocks/*": "./dist/blocks/*",
       "./src/*": "./src/*"
     }
     ```
   - 目标 API：`import { arpgRecipe } from 'keel3d/recipes'`（编译产物 + 完整类型）。

2. **起步模板（仓库外工程）**
   - `templates/starter/`：`package.json`（仅 `keel3d` + `three` + `rapier3d` + `vite` + `typescript`）、`index.html`、`src/main.ts`（`defineGame` + 一个 recipe 起步）、`tsconfig.json`、`README.md`。
   - `examples/flat-shooter/`：一个**真实可玩**的 15 分钟示例（用 `fps-arena` 配方改数据），作为"改数据即出游戏"的活证明。

3. **`create-keel3d` 脚手架**
   - 新包 `packages/create-keel3d/`：`npm create keel3d@latest my-game -- --recipe arpg`
   - 行为：拷模板 → 替换 id/title → 写 recipe 参数 → 打印下一步命令。**不依赖仓库**。

**验收**
```bash
# 在仓库外的空目录
npm create keel3d@latest demo-game -- --recipe arpg
cd demo-game && npm i && npm run dev        # 浏览器可玩
npm run build                                # 产出静态站
```
**风险**：`keel3d` 尚未发布新版本时，模板需支持 `file:` 本地联调（模板里用 `"keel3d": "^0.4.0"` 并在文档写明本地验证方式）。

---

### P2 — npm 门面与发布 【0.5 天 + 用户 OTP】
**交付物**
- 重写包内 README（`scripts/build-lib.mjs` 里改为读 `docs/NPM_README.md` 模板，避免 15 行硬编码）：
  演示站链接 + 3 张截图 + 配方表 + 5 分钟上手 + 仓库外/仓库内两条路径 + 徽章。
- `package.json`：`homepage` → `https://keel.specul.com/3d/hub.html`；补充 `keywords`（vite/webgpu/rapier/game-framework）；`version` → `0.4.0`。
- `CHANGELOG.md`（0.3.0 → 0.4.0：新导出、模板、脚手架）。

**外部阻塞（必须用户参与）**：`npm publish` 需要 **lifeidle 账号的 2FA/OTP**。
> 已知：0.3.1 曾有一次发布被挂起等待 OTP。**本阶段结束时需用户提供一次性验证码**，或由用户自行执行发布命令。

---

### P3 — 演示站升级与同步 【1 天】
**交付物**
- `hub.html` 由 P0 生成器驱动，并新增：
  - **缩略图**：复用已存在的 `qa-live/*.png`（26 张页面截图已在仓里），加 `thumb` 字段。
  - **「从零开始」区块**：`npm create keel3d` 三行命令 + 复制按钮（复用现有 `copyCmd`）。
  - **仓库外 vs 仓库内**两条路径讲清楚（现在只有仓库内 `new-game`）。
  - 补上遗漏的 `fps`（完整战役）与 `flight-arena` 卡片。
- `docs/RECIPES.md` 与 `docs/GENRE_COVERAGE.md §1` 由生成器回填，**矩阵与代码一致**。
- `keel.specul.com` 品牌页（`keel.specul/index.html`、`2d/index.html`）同步"快速开始"入口。

**验收**：`node scripts/catalog-check.mjs` 0 漂移；`hub.html` 卡片数 == catalog 条数；品牌站 JSON/HTML 探针通过。

---

### P4 — 框架质量收口（对齐 §14 DoD） 【1 天，可与 P1/P2 并行】
- 跑 `npm run unused:check`，处理"写了没人用"的积木。
- 新增 `scripts/license-check.mjs`（扫 `package-lock` 传递依赖的 GPL/AGPL/SSPL），接入 CI。
- 逐条核验 `GENRE_COVERAGE.md §14` 七项 Definition of Done，把结果回填该文档（打勾）。
- 每个配方确保：独立 HTML ✓ + probe 选择器 ✓ + RECIPES 一行 ✓ + hub 卡片 ✓（P0 后自动）。

---

### P5 — 剩余品类决策 【0–4 天，可选】
| 选项 | 动作 |
|---|---|
| A（推荐） | 卡牌/桌游 3D + 银河恶魔城 **写入 `§1` 的 Out of Scope**，标注"永不做"，让矩阵无 ❌ |
| B | 各做一条配方（各 1–2 天，走 `docs/compose/spec/` 规格流程） |

---

### P6 — 开源治理收尾 【0.5 天】
- `CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`.github/ISSUE_TEMPLATE/`、PR 模板（含"门禁四件套"检查单）。
- GitHub Release v0.4.0 + tag（与 npm 版本对齐）。
- 已知待办：`docs/RELEASE_v0.3.0.en.md` 对齐（注意该文件在 `.gitignore`，属内部稿）；**两个站点 token 轮换**（安全项）。

---

## 5. 单一真相源设计（Catalog schema）

```ts
export interface GenreCard {
  id: string;              // 'arpg' —— 与 registry / HTML 名一致
  icon: string;            // '⚔️'
  title: string;           // '俯视 ARPG 骨架'
  blurb: string;           // 一句话卖点（卡片副文案）
  tags: string[];          // ['orbit','combat']
  demo: string;            // './arpg.html'  ← 生成器校验文件必须存在
  recipe?: string;         // 'arpg' → 包内导出名 arpgRecipe
  spec: Record<string,string>;  // { camera:'orbit' }
  cmd: string;             // 仓库内脚手架命令
  createCmd?: string;      // 仓库外：npm create keel3d@latest my-game -- --recipe arpg
  note: string;            // 玩法/操作/胜负
  blocks: [string,string][];    // [['Cooldown','CD'], ...]
  thumb?: string;          // 'qa-live/arpg.png'
  status: 'playable' | 'skeleton' | 'planned';
  since?: string;          // 版本或日期
}
```

**生成矩阵**

| 消费方 | 生成内容 |
|---|---|
| `hub.html` | `GENRES = [...]`（注入区） |
| `docs/RECIPES.md` | 配方表 + 胜负表 |
| `docs/GENRE_COVERAGE.md` | §1 矩阵状态列 |
| `scripts/probe-all.mjs` | pages 数组 |
| `vite.config.ts` | 多页 input |
| `src/registry.ts` | `GAME_LOADERS` 条目 |
| `packages/keel3d` | 包 README 配方表 |

> 原则：**catalog 是源，其余全是产物**。任何一处手改都会被 `catalog-check` 判红。

---

## 6. npm 包结构目标

```
keel3d@0.4.0
├─ dist/
│  ├─ lib.js + lib.d.ts              # 公共入口（blocks/content/engine）
│  ├─ recipes/  ← 【P1 新增】编译后的 19 个配方 + 类型
│  ├─ blocks/ · content/ · engine/ · physics/ · world/ · ui/
├─ src/                              # 原始 TS（供深链，保留兼容）
├─ README.md                         # 【P2】完整门面
└─ package.json                      # exports 增加 ./recipes
```

消费方写法（对照）
```ts
// 现在（脆弱：未编译 TS 深链）
import { arpgRecipe } from 'keel3d/src/recipes/arpg';
// P1 之后（稳定：编译产物 + 类型）
import { arpgRecipe } from 'keel3d/recipes';
```

---

## 7. 演示站同步机制

```
src/catalog/index.ts  ──(catalog-gen)──┬─→ hub.html            （卡片/命令/积木/缩略图）
                                       ├─→ docs/RECIPES.md      （两张表）
                                       ├─→ test/probe pages      （选择器）
                                       ├─→ vite.config.ts        （入口）
                                       ├─→ src/registry.ts       （注册）
                                       └─→ packages/keel3d/README（配方表）
                             ↑
                    catalog-check  ← CI 强制 0 漂移
```

**CI 增量**（`.github/workflows/ci.yml`）
```yaml
- run: node scripts/catalog-check.mjs     # 新增：品类零漂移
- run: node scripts/license-check.mjs     # 新增（P4）：许可合规
```

---

## 8. 阶段验收门禁（每阶段都必须全绿）

| 门禁 | 命令 | 现状 |
|---|---|---|
| 类型 | `npm run typecheck` | ✅ 通过 |
| 单测 | `npm test` | ✅ 88/88 |
| 构建 | `npm run build` | ✅ 通过 |
| 浏览器探针 | `node scripts/probe-all.mjs`（25 页） | ✅ CI 内执行 |
| 包体 | `npm run bundle:report` | ✅ |
| 死代码 | `npm run unused:check` | 待跑（P4） |
| 品类一致 | `node scripts/catalog-check.mjs` | **待建（P0）** |
| 许可 | `node scripts/license-check.mjs` | **待建（P4）** |
| 演示站 | `_audit/consistency.mjs` + `responsive-overflow.mjs`（specul 侧） | ✅ 7 页 × 9 宽度 63/63 |

---

## 9. 依赖与外部阻塞

| 项 | 阻塞点 | 处理 |
|---|---|---|
| npm 发布 | **需 lifeidle 账号 2FA/OTP** | P2 末尾请求用户提供一次性码，或由用户自行 `npm publish` |
| 站点推送 | `speculcom` PAT + gh token | 沿用 `_audit/push-www.mjs` / `push-keel.mjs`；**token 轮换列入 P6** |
| 演示站部署 | `keel.specul.com/3d` = `keel3d/dist` 镜像 | 改动链路：build → `keel.specul: node sync-3d.mjs` → push 两仓 |
| 浏览器约束 | 仅 WebGPU（Chrome/Edge 新版、Safari 17+） | 已是产品决策，不改 |

---

## 10. Definition of Done（本计划完成时）

- [ ] 仓库外空目录执行 `npm create keel3d@latest` → `npm i` → `npm run dev` **可玩**（P1）
- [ ] `import { arpgRecipe } from 'keel3d/recipes'` 在**编译产物 + 类型**下可用（P1）
- [ ] 新增一个配方只需改 **1 处**（catalog），其余自动生成且 CI 校验通过（P0）
- [ ] `hub.html` 卡片 == catalog 条数，`fps`/`flight-arena` 不再缺失（P3）
- [ ] npm README 含演示站链接 + 配方表 + 5 分钟上手（P2）
- [ ] npm 发布 0.4.0 + GitHub Release 对齐（P2/P6）
- [ ] `GENRE_COVERAGE.md §1` 无 ❌（实现或显式 Out of Scope）（P5）
- [ ] `typecheck` / `test` / `build` / `probe-all` / `unused:check` / `catalog-check` / `license-check` 全绿（P0/P4）
- [ ] 演示站两侧（specul.com / keel.specul.com）一致性与自适应探针全绿

---

## 11. 任务清单（可勾选）

**P0 单一真相源**
- [ ] T0.1 `src/catalog/types.ts` + `index.ts`（22–26 条，从 hub GENRES 反向提取）
- [ ] T0.2 `scripts/catalog-gen.mjs`（注入式生成 6 个消费方）
- [ ] T0.3 `scripts/catalog-check.mjs` + 接入 CI
- [ ] T0.4 删除 `new-game.mjs` 的 if/else 分支链，改为读 catalog

**P1 仓库外基座**
- [ ] T1.1 `lib.ts` 导出配方 + `tsconfig.lib.json` 编译配方 → `dist/recipes/**`
- [ ] T1.2 `packages/keel3d/package.json` 增加 `./recipes` 子路径导出
- [ ] T1.3 `templates/starter/` 模板工程
- [ ] T1.4 `examples/flat-shooter/` 真实示例（配方改数据）
- [ ] T1.5 `packages/create-keel3d/` 脚手架 + 仓库外端到端验证

**P2 npm 门面**
- [ ] T2.1 `docs/NPM_README.md` 模板 + `build-lib.mjs` 读取
- [ ] T2.2 `homepage`/`keywords`/`version 0.4.0` + `CHANGELOG.md`
- [ ] T2.3 发布（需用户 OTP）→ 发布后 `npm view keel3d` 复核

**P3 演示站**
- [ ] T3.1 hub 注入区 + 缩略图（复用 `qa-live/*.png`）
- [ ] T3.2 「从零开始」区块（`npm create keel3d`）
- [ ] T3.3 补 `fps` / `flight-arena` 卡片
- [ ] T3.4 RECIPES.md / GENRE_COVERAGE §1 由生成器回填
- [ ] T3.5 `keel.specul.com` 品牌页同步快速开始入口

**P4 质量收口**
- [ ] T4.1 `unused:check` 处理
- [ ] T4.2 `scripts/license-check.mjs` + CI
- [ ] T4.3 §14 DoD 逐项回填打勾

**P5/P6 决策与治理**
- [ ] T5.1 剩余 2 品类：实现或写入 Out of Scope
- [ ] T6.1 CONTRIBUTING / issue·PR 模板
- [ ] T6.2 GitHub Release v0.4.0 + tag
- [ ] T6.3 站点 token 轮换 + 清理 `dist_old_*`
