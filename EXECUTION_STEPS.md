# 框架 · 分步施工单（EXECUTION STEPS）

> **主轴**：产品是**框架**；Sample A/B/C 是三个**互不相干**的内容包，只通过框架 API 接入。
> 用法：**按编号顺序执行，一步一停**。每步做完跑「验收」，全绿才进下一步；卡住用「回滚」。
> 配套：`FRAMEWORK_PLAN.md`（战略规划）· `PROGRESS.md`（进度真相源）。两者冲突时以本单为准。
> 三样例（互相独立，禁止互相 import）：Sample A `nightraid` · Sample B `demo-tower`（Phase D）· Sample C `demo-cultivation`（Phase E）。
> 规模：**S** ≈ 1 个工作段（1-2h）｜**M** ≈ 2-3 个工作段｜**L** ≈ 4+ 个工作段。
>
> 规矩（每步都适用）：
> 1. 开工先 commit（§0.0 git）+ 快照（§0.1），完成更新 `PROGRESS.md` 并在本单打勾 ✅。
> 2. 验收必须跑完整五连（§0.3），不绿不进下一步。
> 3. 搬运类步骤 = **只搬家、不改行为**；想改行为记到「行为账本」（附录 B），单独安排。
> 4. 一次批量做完再报（多 bug 一次报齐、一次修完）。
> 5. **上移 L2 必须脱敏**：去掉 Sample A 专名，参数化后才能进 `blocks/`。

---

## 0. 施工前准备（安全网 + 基线）——必须先做

### 0.0 本地 git 安全网（2026-09-13 用户拍板）— S ✅ 已完成
- **目标**：Phase A 拆 `game.ts` 时有 diff/blame/步骤级回滚，不再只靠文件夹快照。
- **做法**：
  1. `git init`（本地仓，**不推远端**）；`.gitignore` 排除 `node_modules/`、`dist/`、`_snapshots/`、`shots/`、`tools/blender-*/`、`assets_new/`。
  2. 首次 commit：当前全绿基线（typecheck/test/build 已过）。
  3. 此后**每步施工开工前 commit、验收通过后再 commit**；快照机制（0.1）保留作发布点备份。
- **验收**：`git log` 可见初始 commit；`git status` 干净。✅
- **规模**：S

### 0.1 快照机制（与 git 双保险的发布点备份）— S ✅ 已完成
- **目标**：任何一步翻车，5 分钟内回到干净状态。
- **做法**：
  1. 建 `scripts/snapshot.mjs`：`node scripts/snapshot.mjs save <label>` 把 `src/ test/ scripts/ package.json vite.config.ts …` 复制到 `_snapshots/<label>/`；`restore <label>` 反向恢复（恢复前自动再存 `auto-before-restore`）。
  2. 约定 label = 步骤号（如 `A5`、`B3`）。每步开工前 `save`，通过验收后不必删（体积小）。
- **验收**：`save A0` 后恢复验证通过（故意改 `rng.ts` → `restore A0` → 改动消失）。✅
- **规模**：S

### 0.2 回归基线（Phase A 的对照物）— S ✅ 已完成
- **目标**：录下「现在的夜袭」作为手感/数据对照物，Phase A 每步与它比。
- **做法**：
  1. `npm run build` → 起服务（端口 4188）→ 依次跑并写入 `shots/baseline/`：
     - `game_state_check` → `state.txt`（ERRORS: none，HUD 30/90）
     - `game_regress` → `regress.txt`（ERRORS: none，webgpu，~75 FPS）
     - `selfcheck_full` → `selfcheck.txt` + 截图
     - `game_probe` → `probe.txt`（4 hostile + 2 ally）
  2. `shots/baseline/README.md` 记录人工观察要点。
- **验收**：`shots/baseline/` 齐套；`state.txt` / `regress.txt` 均无 ERRORS。✅
- **规模**：S

### 0.3 验收工具链核对（2026-09-13 已修复）— 参考信息
**五连验证命令**（下文各步「验收」指的就是这五连 + 本步专项检查）：

```powershell
# 1) 类型     → 期望 EXIT=0
npm run typecheck
# 2) 单测     → 期望 20/20
npm test
# 3) 构建     → 期望 EXIT=0、0 警告（除 chunk 体积提示）
npm run build
# 4) 本地服务（常驻，端口 4188）
node node_modules\vite\bin\vite.js preview --port 4188 --strictPort
# 5) 浏览器回归（另开一个终端）
node scripts\game_state_check.mjs          # 期望 STATE:... ERRORS: none
node scripts\game_regress.mjs http://localhost:4188/   # 期望 ERRORS: none
```

> ⚙️ 环境提示：若在本项目的 WorkBuddy 沙箱里跑（bash shim 不完整、PowerShell 不回传 stdout），
> `npm run` 会坏 → 用 node 直调（例：`node node_modules\typescript\lib\tsc.js --noEmit -p .`），
> 输出写入文件再 Read（详见 `PROGRESS.md` §7）。用户自己在终端里跑则 npm 命令正常。

**本次修复记录**（2026-09-13）：
- 10 个旧脚本（selfcheck_full / game_state_check / game_probe / net_e2e / tank_shot / soldier_shot / tune_aim
  / tune_aim2 / tune_hands / gearcheck）此前用裸 `chromium.launch()`，而本机 Playwright 自带浏览器缺失会直接报错
  → 已全部改为 `chromium.launch({ channel: 'chrome' })`（用系统 Chrome；实测无需任何 flag 即可跑 WebGPU）。
- 两个预览页缺 favicon 导致 `/favicon.ico` 404 噪音 → 已加 `<link rel="icon" href="data:,">`，重建后 404 消失。
- `scripts/game_regress.mjs`（本次新建）与 `scripts/buf_err_probe.mjs`（GPU 错误监测）使用系统 Chrome。

**回归契约（不许动，动了要同步改脚本）**：
DOM id：`#bootFill #bootTxt #btnPlay #btnNet #btnNetHost #btnNetJoin #btnNetGo #net-code #net-code-input #crosshair #hud #ammo-line #health-wrap #ammo-wrap #health-fill #fps-counter`；
调试接口：`?debug=1`、`window.__sfProbe()`、`window.__sfEnd`。
联机 e2e：`scripts/net_e2e.mjs` 依赖 `127.0.0.1:8790`（wrangler pages dev；本地代理变量用 `env -u` 摘除）。

---

## 1. Phase 0 收尾：资产管线（切片 3）

### 1.1 KTX2/Draco 工具链 + 运行时接入 — M ✅ Draco 完成（KTX2 延后）
- **目标**：第三方模型/纹理进项目时体积更小、加载更快；夜袭现有资产做一次转换验证。
- **做法**：
  1. 引入 `@gltf-transform/cli` + `draco3d` + `meshoptimizer`（devDependency）✅
  2. 写 `scripts/assets-encode.mjs`（`npm run assets:encode`）：`public/models/*.glb` → `public/models-opt/`（Draco）；失败回退拷贝原文件 ✅
  3. 运行时：`src/engine/assets/gltf.ts` 的 `createGltfLoader()`（DRACOLoader 指向 `/draco/gltf/`）+ `modelUrl()`；enemy/tank 已改用 ✅
  4. 试点：soldier 715→421KB（−41%）、rifle 60→8KB（−86%）、tank 637→95KB（−85%）✅
  5. **KTX2 留到需要时再补**（需外部 basis 编码器；本期不阻塞）⬜
- **验收**：五连 + 浏览器回归 ERRORS:none（state/regress 已过）✅
- **回滚**：git + `_snapshots/A0`
- **规模**：M

### 1.2 Phase 0 总验收 — S ⬜
- **做法**：跑五连 + `node scripts/selfcheck_full.mjs` + 打一局确认；更新 `PROGRESS.md`：Phase 0 全绿收尾。
- **规模**：S

---

## 2. Phase A：拆 `Game` 大脑（核心战役）

> **总策略**：搬运式重构 —— 每步把 `game.ts` 的一块逻辑**原样搬**进独立 System 文件，`Game` 保留薄转发直到全部搬完（A12 统一删壳）。
> **搬运目标目录**：`src/game/nightraid/systems/`（现有 `FrameSystems.ts` 里的壳逐步拆成独立文件）。
> **接口方式**：System 构造函数注入它需要的依赖（services + 实体引用），**不**再整包传 `Game`；过渡期允许传 `game`，A12 收紧。
> **每步的专项验收 = 五连 + 表中「行为抽查」**。行为抽查指浏览器里手打一局看这几个点。

| 步骤 | 搬运内容（来源方法） | 行为抽查 |
|---|---|---|
| A1 | 系统文件拆分（FrameSystems.ts → 独立文件）+ 命名对齐 | 无（纯组织） |
| A2 | `updateAutoQuality` → QualityAutoSystem | 持续低帧 6s 会自动降档（可用 devtools 降 CPU 验证，或跳过） |
| A3 | `hostPresent`（render + diagnostics）→ RenderPresentSystem | FPS 读数正常、诊断浮层（`` ` ``键）能开 |
| A4 | `hostEffectsFrame`（effects/fires/plumes/casings）→ EffectsSystem | 开枪有曳光/弹壳、爆炸有火光烟 |
| A5 | `hostAtmosphereFrame` + `fadeMuzzleLights` + `nightClouds` → AtmosphereSystem | 枪口闪光衰减正常、夜云在飘、天气正常 |
| A6 | HUD 读取（`updateFireIndicators`、准星扩散、任务/全图地图开关、viewmodel 动画）→ HUDSystem | 准星/弹药/血量/小地图/全图（Tab）正常 |
| A7 | 任务与胜负（`updateHudAndMission` 的任务侧、`checkStreak`、`updateBattleDynamics`、`onCampCaptured`、`gameOver`、`fillEnd`）→ MissionSystem | 打一局到结束：任务进度推进、胜负结算画面正常 |
| A8 | 玩家移动/姿态（`fixedUpdate` 步兵分支前半 + `player.update` 调用链）→ MovementSystem | 走路/冲刺/跳/蹲/趴手感不变 |
| A9 | 战斗（`fixedUpdate` 的 `weapon.update`/`enemies.update`/barrels/destructibles）→ CombatSystem | 开火命中、敌人死亡、油桶爆炸 |
| A10 | 载具（`fixedUpdate` 驾驶分支、`spawnTanks`/`disposeTanks`/`toggleTankBoarding`/`leaveTank`/`blastTanks`/`onJeepDestroyed`）→ VehicleSystem | 上坦克/开炮/下车、开吉普 |
| A11 | 联机（`onNetEvent`、快照收发、RemotePlayer/GhostSwarm 更新）→ NetSystem | `net_e2e.mjs` 全绿 + 双标签手测 |
| A12 | `Game` 瘦身收尾：删全部已搬走的壳/死代码 | 全量回归 + 人工整局 |

各步详述：

### A0 准备：契约与目录 — S
- 建 `src/game/nightraid/systems/` 下每系统一个文件；`NightRaidGame.ts` 汇总注册（保持 7 个现有系统的注册顺序不变——顺序就是执行顺序）。
- 在 `PROGRESS.md` 贴一张「方法 → 目标系统」对照表（从上面表格复制），每完成一行标注。
- **验收**：五连（此时无行为变化，应全绿）。

### A2–A11 各步骤统一模板
- **做法**：1) 从 `game.ts` 剪切目标方法体 → 粘到对应 System 类；2) System 构造函数补依赖；3) `game.ts` 原位留一行 `this.sys.xxx()` 转发（或直接调用 System 实例）；4) 删除多余 import。
- **验收**：五连 + `game_state_check`（ERRORS: none）+ 上表「行为抽查」。
- **回滚**：`_snapshots/<步骤号>`
- **规模**：A2 S ｜ A3 S ｜ A4 S ｜ A5 M ｜ A6 M ｜ A7 L ｜ A8 M ｜ A9 L ｜ A10 M ｜ A11 L
- **注意**：
  - A7 是大头（`updateHudAndMission` 约 250 行），拆前先通读，按「任务状态 / HUD 写入 / 语音与播报」三段搬。
  - A9 涉及 `physics.step()` 的调用时序——**搬运时保持调用顺序逐字不变**（时序=手感）。
  - A11 联机部分与 `netMode` 状态耦合，先搬事件与快照，再搬 ghosts 更新；e2e 用 `net_e2e.mjs` 验证。

### A12 `Game` 瘦身收尾 — M
- **做法**：删除所有转发壳与死代码；`Game` 最终只留：services + 实体容器 + 屏态机（menu/playing/paused/over）+ 输入绑定 + 场景装配。目标：2347 行 → **显著下降**（目标 <1000 行，逐行核对，不为凑数硬拆）。
- **验收**：五连 + `selfcheck_full` + `net_e2e.mjs` + 人工整局（步行局/驾驶局/联机局各一）。
- **产出**：`Game` 类结构图更新到 `PROGRESS.md`；Phase A 打勾。

---

## 3. Phase B：通用构件上移 `src/blocks/`

> 原则：**只把「换游戏也要用」的东西上移**；夜袭专属（士兵外观/坦克/吉普）留在内容层。
> 每步先上移、再让夜袭改用、再验证夜袭无变化。

### B1 `blocks/` 目录与导出规范 — S
- 建 `src/blocks/index.ts` 出口；约定「blocks 不 import 内容层、内容层可 import blocks」。

### B2 `Unit`（单位基座）— M
- 从 `player.ts` + `SoldierFactory` 抽象：配置驱动（半径/高度/速度/HP 从参数注入）；物理体创建封装。
- 验收：夜袭玩家改用后，五连全绿 + 移动/受击手感不变。

### B3 `CameraRig`（相机机架）— M
- fps / chase / orbit / free 四种模式；**含运行时 `setMode()` + 短时 lerp 过渡**（为 Sample C 预埋，本步不强制夜袭使用切换）。
- 夜袭 fps + tank chase 先迁移验证。

### B4 `Pool`（对象池）— S
- 把 muzzle light / flare / casing 三个散落池泛化为 `Pool<T>`。

### B5 `Path` + `Steering`（寻路三件套之两个标准件）— M
- `Path`：样条/waypoint 跟线（新写，~150 行）。
- `Steering`：从 `enemy.ts` 抽「直扑/侧翼/分离/限速/停火距离」为纯函数工具。
- 验收：夜袭 AI 改用 Steering 后行为抽查（敌人战术不变）。

### B6 `SceneBuilder` / `MapBuilder`（seeded 模式）— M
- `terrain.ts` + `mapgen.ts` 收进 `blocks/scene/`；`gen(seed)` 注入（行为逐点一致：见 B9 的确定性测试）。

### B7 `CONFIG` 注入化 — M
- `physics/world.ts`、`player.ts` 去掉 `CONFIG` 直接 import，改构造参数 + 默认值回退；分批改，每批五连。

### B8 `MapSpec.fixed` 机制 + 1 张示例图 — M
- 定义 `FixedMapDef` 数据结构（地形参数 + POI + 出生点）；加载器 + 菜单可切（默认隐藏，URL 可选）。
- 用 1 张小图验证机制（不必是夜袭正式图，demo 级别即可）。

### B9 Phase B 总验收 — S
- **mapgen 确定性回归**：同 seed 地图与改造前逐点对比（写一次性脚本 `scripts/mapgen_determinism.mjs`，输出 diff=0）。
- 五连 + 人工整局；`PROGRESS.md` 更新。

---

## 4. Phase C：`defineGame` 内容包 API

### C1 契约类型（`src/content/define.ts`）— M
- `GameSpec` / `UnitDef` / `PlayerSpec` / `MapSpec` / `SceneBuilder` 类型 + `defineGame()` 骨架（先只做类型与空实现，不改运行时）。

### C2 夜袭重表达（`src/game/nightraid/define.ts`）— M
- 把 `NightRaidGame` 的装配改写为一份 `defineGame` 配置；`MapSpec` 走 `seeded`。
- 此时 `Game`（已被 A12 瘦身）变成「内容层私有装配器」，由 `define.ts` 调用。

### C3 接线与路由 — S
- `main.ts` 改为 `createGame(nightraidSpec)`；加 `?game=` 参数路由（默认 nightraid，未知值回退）。

### C4 全量回归 — M
- 五连 + `net_e2e.mjs` + PvP + 驾驶局；`PROGRESS.md` 更新：**夜袭已变成「框架上的第一个内容包」**。

---

## 5. Phase D：demo-tower 验收样例 B（框架成立的第一证明）

### D1 骨架 — M
- `src/game/demo-tower/`：一份 `defineGame` + 1 张 fixed 图 + `camera: 'orbit'`；空场景能进能出。

### D2 玩法链 — L
- 敌人沿 `Path` 走 → 波次生成（3-5 波）→ 塔放置（射线拾取 + 网格吸附 + 经济）→ 塔攻击 → 基地 HP 与胜负。

### D3 最小 HUD — S
- 三读数：金钱 / 波次 / 基地血量。不做结算页。

### D4 验收（硬标准）— M
- **零其他样例代码**：`src/game/demo-tower/` 不 import 任何 `nightraid` / `demo-cultivation` / `core/game` 的文件（grep 验证）。
- **零内核改动**：`src/engine/`、`src/blocks/` 无改动（快照 diff 验证）。
- 五连 + 浏览器入口 `?game=tower` 可玩；截图存档。
- **产出**：框架成立的证据之一 → 更新 README + `PROGRESS.md`。

---

## 5.5 Phase E：demo-cultivation 验收样例 C（stream + 多视角）

> 目标：证明 `MapSpec.stream` 最小可工作 + `CameraRig` 运行时切换成立。
> **红线**：不做真 MMO（无专用服务器/无缝大世界/持久化）；联机可选、失败不阻塞。

### E1 ChunkWorld 最小可工作 — M
- `blocks/chunk/`：chunk 定义加载/卸载 + 以玩家为中心的加载环（半径 1）+ 远处 chunk 简化 LOD 或直接卸载。
- 验收：单元测试（chunk 进出环的加载/卸载断言）+ 五连。

### E2 运行时相机切换 API 收口 — S
- 确认 `CameraRig.setMode(fps|chase|orbit)` + lerp 过渡可用；`GameSpec.camera` 支持 `{ default, allow }`。
- 验收：单测或最小 playground 切换无跳变；夜袭/塔防单模式回归不变。

### E3 骨架 — M
- `src/game/demo-cultivation/`：`defineGame` + 2–3 chunk stream 地图 + `camera:{default:'chase',allow:[fps,chase,orbit]}`；空场景能走动能切视角。
- **美术注记（用户拍板）**：另找/做修仙 GLB（修士/妖兽/山林小场景）。E1–E2 与本步骨架用**占位几何**验收机制；正式 GLB 到位后替换（不阻塞 E1–E2 验收）。

### E4 玩法链 — L
- 第三人称 ground 移动 → 修炼点站桩涨修为条 → 1–2 种游荡妖兽（Steering + GridAStar 绕障追击）→ 简易飞剑/法术命中。
- HUD：修为条 + 境界 + 当前视角模式。

### E5 验收（硬标准）— M
- **零其他样例代码**：`demo-cultivation/` 不 import `nightraid` / `demo-tower` / `core/game`（grep 验证）。
- **零内核改动**：`src/engine/`、`src/blocks/` 无改动（相对 E1/E2 之后的快照 diff）。
- 键位 1/2/3 切换视角可玩；走动触发 chunk 加载；五连 + 截图存档。
- **样例独立性总验收**：A/B/C 两两 grep 互不 import；`engine/`+`blocks/` 零反向依赖样例。
- **产出**：三样例齐且互不依赖 → 框架完工证据链闭合 → 更新 README + `PROGRESS.md`。

---

## 6. Phase F：开源打包（概要，另开任务时再细化）

- npm 三包拆分（`@yexi/core` / `@yexi/blocks` / `@yexi/content`）或单包多入口。
- 模板仓库 `game-template` + 对应三样例路径的示例 spec（fps / 塔防 / 修仙多视角）。
- 文档：QUICKSTART / API / ADAPT（ADAPT 含修仙一页）。
- README 重写（框架叙事 + demo-tower / demo-cultivation 链接）。

---

## 附录 A：常见踩坑（做之前先读）

1. **`game.ts` 里 `fixedUpdate` 的调用顺序 = 手感**：搬运时顺序逐字保持，尤其是 `physics.step()` 的位置。
2. **Sprite 的 geometry 永远不要 dispose**（three 全 app 共享单例；traverse+dispose 必须 `if (isSprite) return`）——Phase A/B 搬 dispose 逻辑时最容易踩。
3. **共享材质不要 dispose**（`MaterialCache` 的材质是全局缓存；士兵 `matBody` 才是 per-soldier）。
4. **WebGPU 错误可能静默刷屏**：对局中若手感异常先跑 `buf_err_probe.mjs` 看 GPU 错误率。
5. **net_e2e 需要先起 wrangler**（`npx wrangler pages dev dist --port 8790`，本地代理变量用 `env -u` 摘除后再跑）。
6. **预览服务是 dist 静态服务**：`vite preview` 之前必须先 `npm run build`，否则脚本测的是旧代码。

## 附录 B：行为账本（搬运期发现的行为问题记这里，不顺手改）

| 日期 | 步骤 | 现象 | 处理 |
|---|---|---|---|
| — | — | （暂无） | — |

## 附录 C：每步验收记录（打勾表）

| 步骤 | 快照 | 五连 | 行为抽查 | 日期 |
|---|---|---|---|---|
| 0.0 git init | — | ✅ | — | 2026-09-13 |
| 0.1 快照机制 | A0 | ✅ | restore 验证 | 2026-09-13 |
| 0.2 回归基线 | — | ✅ | shots/baseline 齐套 | 2026-09-13 |
| 0.2 回归基线 | | | | |
| 1.1 资产管线 | | | | |
| 1.2 Phase 0 验收 | | | | |
| A1 目录拆分 | | | — | |
| A2 QualityAuto | | | | |
| A3 RenderPresent | | | | |
| A4 Effects | | | | |
| A5 Atmosphere | | | | |
| A6 HUD | | | | |
| A7 Mission | | | | |
| A8 Movement | | | | |
| A9 Combat | | | | |
| A10 Vehicle | | | | |
| A11 Net | | | | |
| A12 收尾 | | | | |
| B1–B9 | | | | |
| C1–C4 | | | | |
| D1–D4（塔防） | | | | |
| E1 ChunkWorld | | | | |
| E2 相机切换 | | | | |
| E3–E5 修仙样例 | | | | |
