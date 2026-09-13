# 框架 V2 计划 —— 先进 · 好上手 · 好用

> 主轴不变：**框架是产品**。  
> 本计划在「三样例已跑通」的基础上，专攻 **开发者体验（DX）** 与 **技术先进性**，让新人 15 分钟做出可玩原型，而不是先读完源码。  
> 夜袭只是 Sample A：**不拖累 API 形状**；能跑即可，不为兼容旧接线牺牲框架设计。

---

## 0. 成功标准（Definition of Done）

| 标准 | 可度量验收 |
|---|---|
| 15 分钟上手 | 新人按 README：`install → new-game → 改一个 System → preview` 能看到自己的场景 |
| 一份配置接入 | 新游戏 **不改** `main.ts` 业务分支；只注册一份 `GameSpec` + 自动路由 |
| 命令行脚手架 | `npm run new-game <id>` 生成目录 + 路由 + 独立 HTML（可选） |
| 类型友好 | `GameSpec` / `System` / 积木 API 有完整 JSDoc；IDE 补全可用 |
| 先进基线保持 | WebGPU 唯一 · 最新 three/Rapier · 热路径零分配 · 26+ 单测全绿 |
| 可演示 | 三样例 + 新脚手架游戏均可 `preview` 打开 |

**非目标（本阶段不做）**：npm 多包发包、可视化编辑器、真 MMO、WebGL 回退。

---

## 1. 现状差距（相对「好用」）

| 痛点 | 现状 | 目标 |
|---|---|---|
| 接入成本 | `main.ts` 手写 import + if/else 分支 | 注册表 + `createGame(id)` |
| 脚手架 | 复制 `demo-template` 再手改 | `npm run new-game` |
| 样例宿主 | tower/cult 等自己 `createXxxGame` + 手动 addSystem | 统一 `GameHost` / `mountSample` |
| 文档 | QUICKSTART 已有，但未覆盖「一键脚手架」 | 与命令对齐 |
| 白天/演示 | 各样例自己调光照 | L2 `Daylight` 已有，宿主可选开关 |
| 诊断 | WebGPU 无 `render.info` | 可选：帧时间面板（已有 FPS） |

---

## 2. 目标架构（启动链路）

```
main.ts
  └─ boot()
       ├─ createEngineAsync()          // WebGPU canvas
       ├─ new Engine({ headless })
       ├─ resolveGameId()              // ?game= | __GAME_ID__ | pathname
       ├─ loadGameModule(id)           // 内容包注册表（自动/静态）
       └─ mountGame(engine, module)    // 统一挂 systems + present + daylight

src/content/
  define.ts      GameSpec 类型
  defineGame.ts  spec → GameModule
  registry.ts    静态注册表（id → loader）

src/game/<id>/
  define.ts      export const spec + systems 工厂
  index.ts       re-export（可选）
```

**铁律不变**：`game/*` 互不 import；`engine/blocks/content` 不依赖 `game/*`（注册表用动态 import 或由 `main` 注入 map，避免 content 反向依赖样例）。

---

## 3. 分阶段实施（按序，每步五连验收）

### Phase U1 — 统一游戏宿主（核心 DX）

**目标**：样例与新游戏共用一条启动路径。

1. 新增 `src/content/host.ts`（或 `src/engine/host.ts`）：
   - `mountSampleGame({ id, engine, systems, daylight? })`
   - 自动：`world.playing = true`（样例默认）+ present system + 可选 `applyDaylight`
2. 改 `main.ts`：`createXxxGame` 分支收敛为 `loaders[id]` Map。
3. 夜袭保持特殊路径（完整 `Game` 类），但 id 仍走同一 `resolveGameId`。

**验收**：`/?game=tower|cultivation|flight|race|template` 与三个 HTML 入口行为不变；夜袭 regress 0 错误。

**规模**：M

---

### Phase U2 — `defineGame` 一等公民

**目标**：内容包导出标准模块，宿主只认 `GameModule`。

1. 扩展 `GameSpec`（向后兼容）：
   ```ts
   interface GameSpec {
     id: string;
     title: string;
     daylight?: boolean;          // 演示用白天
     create: (ctx: GameCreateContext) => GameModule | { systems; dispose? };
   }
   ```
   或保留 `defineGame(spec, systems)` 并增加 `create` 工厂字段。
2. `demo-tower` / `demo-cultivation` / `demo-template` / `flight` / `race` 改为导出 `defineGame({...})` 单一入口。
3. `loadGameModule(id)`：`import(\`./game/${id}\`)` **不可用**（打包需静态分析）→ 用 **静态注册表文件** `src/content/registry.ts`：
   ```ts
   export const games = {
     tower: () => import('../game/demo-tower'),
     cultivation: () => import('../game/demo-cultivation'),
     // ...
   };
   ```
   脚手架会往这里加一行。

**验收**：五样例经宿主加载；新增游戏只改 registry 一行 + 新目录。

**规模**：M

---

### Phase U3 — 脚手架 `new-game`

**目标**：一条命令生成可运行骨架。

1. `scripts/new-game.mjs`：
   - 读 `src/game/demo-template` → 复制为 `src/game/<id>`
   - 替换 `id` / `title` / 系统名
   - 在 `registry.ts` 插入动态 import
   - 可选：生成 `<id>.html` 并写入 `vite.config.ts` input（脚本用正则/标记注释插入）
2. `package.json`：`"new-game": "node scripts/new-game.mjs"`
3. 文档：QUICKSTART 第一步改为 `npm run new-game mygame`

**验收**：`npm run new-game hello` 后 `npm run build && preview` 打开 `/?game=hello` 或 `/hello.html` 可见占位场景。

**规模**：M

---

### Phase U4 — 样例接入新宿主（去手写分支）

**目标**：`main.ts` 无 per-game 业务 if 链。

1. 各 `demo-*` 统一导出：
   ```ts
   export default defineGame({
     id: 'tower',
     title: 'Tower',
     daylight: true,
     create: ({ scene, camera }) => ({ systems, dispose }),
   });
   ```
2. `main.ts` 仅：resolve id → `registry` → `create` → `mountSampleGame`。
3. 夜袭：`create` 包装现有 `Game` + `createNightRaidGame`（不拆玩法）。

**验收**：全部入口 + 夜袭 regress。

**规模**：L（夜袭接线最烦）

---

### Phase U5 — 文档与 DX 打磨

1. README「最短路径」改为脚手架命令。
2. `docs/API.md` 补 `GameCreateContext` / registry 约定。
3. `docs/ADAPT.md` 每个品类给出「复制哪份模板 + 改哪三处」。
4. JSDoc：`defineGame` / `CameraRig` / `ChunkWorld` / `Path` 关键方法。

**验收**：按文档盲测路径（只读 README）能建出 hello 游戏。

**规模**：S–M

---

### Phase U6 — 先进性补强（可选，不挡 DX）

| 项 | 说明 | 优先级 |
|---|---|---|
| 帧诊断面板 | FPS/frameMs 已有；可加 `world.time`、system 耗时（dev 开关） | 中 |
| `Daylight` 宿主开关 | `spec.daylight` 已在 U2 | 高（随 U2） |
| 热重载友好 | Vite HMR 对 systems 的说明（手动刷新即可） | 低 |
| KTX2 编码脚本完善 | `assets-encode` 支持纹理→ktx2（需 basis 工具） | 中 |
| 示例 GLB 包 | 模板用占位几何即可，不挡上手 | 低 |

**验收**：不引入新依赖地雷；五连保持绿。

---

## 4. 详细步骤清单（执行顺序）

| # | 步骤 | 产出 | 验收 |
|---|---|---|---|
| U1.1 | 实现 `mountSampleGame` + present/daylight | `content/host.ts` | 编译过 |
| U1.2 | `main.ts` 改为 loaders Map | 单一入口逻辑 | 三 HTML + ?game 全开 |
| U1.3 | 夜袭接 loaders（包装现有 Game） | 无行为变化 | regress + e2e 可选 |
| U2.1 | 扩展 `GameSpec.create` + 类型 | define.ts | tsc |
| U2.2 | 静态 `registry.ts` | 内容包懒加载 | 五样例 |
| U2.3 | 各 demo 改 `export default defineGame` | 统一模块形 | 五连 |
| U3.1 | `scripts/new-game.mjs` | 脚手架 | 生成 hello 可跑 |
| U3.2 | package.json + 文档 | `npm run new-game` | 盲测 |
| U4.1 | 删除 main 内 per-game 分支 | main &lt; ~80 行 | 全入口 |
| U5.1 | README / API / ADAPT / JSDoc | 文档对齐 | 盲测路径 |
| U6.x | 诊断/KTX2（可选） | 增强 | 五连 |

---

## 5. 风险

| 风险 | 缓解 |
|---|---|
| 动态 import 打包丢模块 | 必须用**静态** registry 对象字面量 |
| 夜袭接线复杂 | 只做适配器，不改 `Game` 内部 |
| vite 多页 HTML 脚手架改配置脆弱 | 生成 HTML + 手写/标记块插入 input；失败则只生成目录 |
| 范围膨胀到编辑器/发包 | 本计划 DoD 明确非目标 |

---

## 6. 工作量粗估

| 阶段 | 规模 |
|---|---|
| U1 宿主 | 0.5–1 天 |
| U2 defineGame + registry | 0.5–1 天 |
| U3 脚手架 | 0.5 天 |
| U4 样例统一 | 0.5–1 天 |
| U5 文档 | 0.5 天 |
| U6 可选 | 按项 |

**合计约 2.5–4 个工作日**（当前代码基上增量，不重写玩法）。

---

## 7. 与既有文档关系

- `FRAMEWORK_PLAN.md`：架构与三样例验收（仍有效）  
- **本文件**：V2 DX/先进性专章，冲突时 **本文件优先**（更新的用户目标）  
- `EXECUTION_STEPS.md`：历史施工单；新步骤以本文件 U1–U6 为准  
- `PROGRESS.md`：执行时更新勾选  

---

## 8. 已定 / 待拍板

**已定（2026-09-13 用户）**
- 框架优先于「保夜袭旧结构」；夜袭不回归仍要跑，但不约束 API。
- 目标：先进 + 好上手 + 好用。

**待你拍板（不挡 U1–U2）**
- 脚手架是否同时生成独立 `.html` 入口（推荐：生成）。
- 默认样例 id：`nightraid` 还是 `template`（推荐：保持 nightraid 为默认，模板作显式入口）。
