# 可开源 3D 游戏框架 —— 整体规划

> **主轴（用户定调，不可动摇）**：**框架本身是产品**。目标是做一个能承载**各种各样三维游戏**的开源基座——
> 别人 clone 下来，只填「模型 + 玩法 + 场景」，就能做出 FPS / 塔防 / 开放世界骨架开放世界 / 飞行 / 赛车等任意品类，不用从底层搭引擎。
>
> **三个样例互不相干**：FPS 骨架（Sample A）、demo-tower（Sample B）、demo-cultivation（Sample C）
> 彼此**没有任何内容共享、没有代码依赖、没有先后从属**——它们唯一的共同点是**都只通过框架 API 接入**。
> FPS 骨架不是「母体」，只是**碰巧已经存在的、最复杂的那个内容包**；拆它只是抽框架的手段，不是目的。
>
> 本规划只描述方案，未动代码。

## 0. 交付物定位（2026-09-13 用户拍板 · 三样例 + 框架主轴定调）

> **框架本身就是产品**：本次交付的是「开源游戏基座」。
> 三个样例是**互相独立的内容包**（L3/L4），用来从不同路径证明框架成立；将来任何新游戏 = **再加一个内容包，不碰框架、不碰其他样例**。

| 角色 | 定位 | 本次交付义务 |
|---|---|---|
| **框架**（L1 内核 + L2 积木 + L3 契约 + 工具链 + 文档） | **产品本体** | 全部（Phase 0–F） |
| FPS 骨架（Sample A） | 独立内容包之一。因已存在且最复杂（FPS + seeded + P2P），用作**压力测试样本**；重构后行为不回归 | **不回归**；其内容增强（手工图/音频瘦身）归FPS 骨架自己的未来任务 |
| demo-tower（Sample B） | 独立内容包之一。塔防，**零FPS 骨架代码、零 Sample C 代码** | 最小可玩；验证 `MapSpec.fixed` + Path + orbit |
| demo-cultivation（Sample C） | 独立内容包之一。开放世界骨架开放世界，**零FPS 骨架代码、零 Sample B 代码** | 最小可玩；验证 `MapSpec.stream` + 运行时相机切换 |

### 0.1 样例独立性铁律（主轴的操作化）

1. **`src/game/<name>/` 之间禁止互相 import**——A/B/C 任一样例不得引用另一个样例的任何文件（grep 验收）。
2. **样例只 import 框架**：`src/engine/`、`src/blocks/`、`src/content/`。不允许样例间「先抄再改」。
3. **框架不得反向依赖任一样例**：L1/L2 里不允许出现 `nightraid` / `demo-tower` / `demo-cultivation` 字样（grep 验收）。
4. **从FPS 骨架抽出的积木必须「脱敏」**：进 L2 前去掉FPS 骨架专名（士兵/坦克/夜战 HUD 等），参数化后才能上移。
5. **验收标准与样例数量无关**：框架完工 = 三样例各自可玩且互不依赖；将来加第 4 个样例不应改 L1/L2。

**三样例对框架路径的覆盖（设计依据——证明「各种三维游戏」而不是只证这三个）**：

| 框架能力 | Sample A FPS 骨架 | Sample B demo-tower | Sample C demo-cultivation | 将来品类（不交付，只保证 API 装得下） |
|---|---|---|---|---|
| `MapSpec.seeded` | ✅ 主模式 | — | — | Roguelike / 无尽遭遇 |
| `MapSpec.fixed` | — | ✅ 主模式 + 示例图 | — | 战役 / 竞技场 / 赛车 |
| `MapSpec.stream` | — | — | ✅ 主模式（最小 ChunkWorld） | 开放世界 / 大型休闲 |
| 相机 fps | ✅ 主视角 | — | ✅ 可切换之一 | 步行模拟 / 恐怖 |
| 相机 chase | 坦克附带 | — | ✅ **主视角（第三人称）** | 动作 ARPG / 赛车 |
| 相机 orbit | — | ✅ 主视角 | ✅ 可切换之一（顶部俯视） | RTS / 塔防 / MOBA |
| **运行时相机切换** | 部分（上下坦克） | 无 | ✅ **一等公民**（键位 1/2/3） | 自由视角沙盒 |
| 物理 ground | ✅ 第一人称 | 无玩家体 | ✅ 第三人称控制器 | 平台跳跃 |
| 物理 air / vehicle | （FPS 骨架有载具，走 vehicle） | — | — | 飞行 / 赛车（spec 骨架） |
| Path 跟线 | — | ✅ 敌人行进 | 可选 | 跑酷 / 护送 |
| Steering AI | ✅ 敌人 | 可选 | ✅ 开放世界游荡怪 | 生存 / 割草 |
| GridAStar | 可选 | — | 建议启用 | RTS / 开放世界 |
| ChunkWorld / 远处 LOD | — | — | ✅ 必须 | 大地图任意品类 |
| P2P 联机 | ✅ 完整 | — | 可选加分 | 合作 PvE / 小房间 PvP |

**范围红线（Sample C）**：所谓 MMORPG 是**观感与品类气质**（开放世界 + 多视角 + 游荡 AI），
**不是**真·MMO 架构——不引入专用服务器、无缝万人同图、数据库持久化。
联机若做，仅限现有 P2P 小房间合作（≤8 人），失败即降级单机，不阻塞框架完工。

**推论**：
1. FPS 骨架的 `fixed` 手工图、音频瘦身**全部移出框架关键路径**——那是FPS 骨架内容包自己的事。
2. `MapSpec.stream` 从「本期仅接口位」**升级为「最小可工作」**（Sample C 是其验收载体）：
   ChunkWorld 要能加载 2–3 个 chunk + 预取环 + 远处降 LOD，不要求 MMORPG 级流式。
3. **运行时相机切换**从「每游戏一个默认值」升为 L2 `CameraRig` 一等 API（`setMode()` + 平滑过渡）。

---

## 1. 核心承诺（一句话）

**框架维护 Layer 1+2（内核+积木），任何游戏只填 Layer 3（内容包），互不相识。**
内容包 = `GameSpec`（声明你的游戏）+ `System`（你的玩法逻辑）+ `UnitDef`（你的单位）+ `SceneBuilder`（你的场景）。

---

## 2. 四层结构

| 层 | 位置 | 谁维护 | 内容 |
|---|---|---|---|
| L1 内核 | `src/engine/` | 框架 | `Engine`（rAF 循环 + fixed-dt 累加器 + 状态机）、`System`/`GameModule` 契约、`RendererFacade`（WebGPU 唯一）、`PhysicsWorld`（Rapier）、`AssetHub`、`AudioEngine`、`Input`、`QualityController`、`Emitter` 事件总线 |
| L2 积木 | `src/blocks/`（新建） | 框架 | 通用游戏构件（**与具体游戏无关**）：`Unit`、`UnitRegistry`/`Spawner`、`CameraRig`（fps/chase/orbit/free + `setMode()` 切换）、`Pool`、`Effects`、`Path`、`Steering`、`GridAStar`（可选）、`MapBuilder`（seeded/fixed/stream）、`ChunkWorld`、`NavMesh`（仅接口位） |
| L3 内容包 | `src/game/<name>/` | **别人填 / 样例各占一目录** | `GameSpec` + 该系统集 + 单位表 + 场景构建器 + `config`。**目录之间零依赖** |
| L4 示例 | `src/game/nightraid/`、`src/game/demo-tower/`、`src/game/demo-cultivation/` | 样例作者 | 三个**互相独立**的可运行成品；各自证明一条框架路径 |

**判断标准（主轴）**：一段代码如果「**另一个不相干的游戏**也要用它」→ 属于 L1/L2 框架；
如果「只属于某一个游戏的口味」→ 属于该游戏的 L3。
物理/渲染/循环/输入/音频/资产池/相机 rig 是框架；
士兵/坦克/FPS 骨架 HUD/塔防波次表/开放世界骨架境界文字是各内容包私有。

---

## 2.5 技术基线：前沿 + 不向下兼容 + 最高效率（用户新增约束）

> 约束：全部用最新技术；**不向下兼容老设备**；帧率/画质/运行效率拉满。
> 这直接推翻内核两处现状：`createEngineAsync` 的「WebGL2 回退」与「`?renderer=webgl` 开关」是向下兼容包袱 → **删掉** ✅；
> `rapier3d-compat`（wasm base64 内联）→ 切换**标准 `@dimforge/rapier3d`**（独立 .wasm）✅。
> ⚠️ **2026-09-13 实测修正**：标准 rapier3d 与 compat **同为单线程**（wasm 无 SharedArrayBuffer/pthread 特征，官方 JS 包无多线程构建）；换包收益 = 独立缓存 + 首屏 −26% + streaming 编译；**多线程 = 未来自建编译的扩展位**；不需 COOP/COEP。

### 2.5.1 对照表（当前 → 前沿目标 → 代价/权衡）

| 维度 | 当前 | 前沿目标 | 代价 / 权衡 |
|---|---|---|---|
| 渲染后端 | WebGPU 优先 + **WebGL2 回退**（`?renderer=webgl` 开关） | **WebGPU 唯一路径**，删 WebGL2 回退与开关 | 老 Safari(<17)/Chrome(<113)/旧移动端打不开——这正是「不向下兼容」的代价，需接受 |
| three 版本 | ^0.186 | 保持最新 stable（r18x），锁定 WebGPU 管线 | 升级时跟 release note 对一次 node material graph 变动 |
| 物理 | `rapier3d-compat`（wasm base64 内联，JS 单文件 2.72MB） | **`@dimforge/rapier3d` 标准包**（独立 .wasm：独立缓存 + 首屏 −26% + streaming 编译）✅ 已实施 | ⚠️ 实测修正：官方 JS 包**无多线程构建**（单线程，无 SAB/pthread）→ 多线程列未来扩展位；**不需 COOP/COEP 头**（这正是删掉部署约束的收益）；代价 = 必须 HTTP 服务（file:// 不能跑）；测试管线用 esbuild alias → compat（同版本引擎、Node 友好） |
| 纹理 | 裸 PNG / webp | **KTX2 / Basis Universal** GPU 压缩纹理 | 一次性转码工具链；KTX2 需 superfluous 转 `.ktx2` + 运行时 transcoder（小体积） |
| 模型 | 裸 GLB | **Draco / Meshopt** 压缩 + **实例化**（大量同模型） | 模型转码工具链；实例化需按材质合并 draw call（对单位多时有实质收益） |
| 粒子/特效 | CPU 弹道 + 简单池 | **GPU instancing / compute 级粒子**（按画质档降级） | 复杂度↑、调试难；用 QualityController 按档开关，低档回退 CPU 路径 |
| JS 输出 | 默认 target | **`build.target: 'esnext'` / `chrome110+`** 不向下转译 | 与「不向下兼容」一致；老浏览器执行不了新语法 |
| 后期/色调 | sRGB 基础 | WebGPU **node 后期链 + ToneMapping**（Bloom/SSAO 按档） | 后期链在 WebGPU 是 quality 增益但也是帧率杀手，必须挂 QualityController 分档 |

### 2.5.2 引擎选型：留在 three.js，不上 Babylon.js

- 现状已用 three r186 + WebGPU，**迁移到 Babylon.js 是全量重写**，违背「保持框架、只换内容层」铁律 → 不换。
- three.js 的 `WebGPURenderer` + node material graph 就是当前前端 3D 的前沿位，足够支撑「技术前沿」目标。
- 若将来要 VR/AR，走 **WebXR**（three 原生支持），作为 L2 可选能力，不进内核默认。

### 2.5.3 三个目标 → 手段映射

| 你的目标 | 主要抓手 |
|---|---|
| ① 站到技术前沿 | WebGPU 唯一 + 标准 rapier3d（独立 wasm/缓存）+ KTX2/Draco + 最新 three |
| ② 更高画质/帧率 | WebGPU 后期链 + GPU 粒子 + 实例化（全部挂 QualityController 分档，低配自动降级） |
| ③ 运行效率最高 | 独立 wasm 缓存（streaming 编译）+ 纹理/模型压缩（下载与上传双省）+ draw call 合并 + 对象池（内核已具备） |

> 关键原则：**所有「提质」项都挂 `QualityController` 分档**——前沿 ≠ 把最低配设备拖死，而是高配拉满、低配优雅降级（但都不再向下兼容 WebGPU 不可用设备）。

---

## 3. 内容包 API（别人到底写什么）

### 3.1 一个塔防游戏长这样（= Sample B demo-tower 的内容层）

```ts
// src/game/demo-tower/index.ts
import { defineGame } from '../../../content/define';
import { WaveSystem, EconomySystem, TowerAttackSystem } from './systems';

export const tower = defineGame({
  id: 'tower',
  title: 'Tower',
  map: { kind: 'fixed', maps: [
    { id: 'grass1', terrain: grassMap(), navmesh: 'grass1.nav', spawn: { bases: 2, lanes: 1 } },
  ]},                                        // MapSpec.fixed：手工图 + 离线烘焙
  camera: 'orbit',                            // L2 CameraRig：斜俯视（塔防标配）
  units: [
    { key: 'goblin', model: 'goblin.glb', hp: 40, behavior: 'path', path: 'lane0' },  // 沿 Path 样条走
    { key: 'golem',  model: 'golem.glb',  hp: 300, behavior: 'path', path: 'lane0' },
    { key: 'tower_rapid',  model: 'tower_rapid.glb',  static: true, placeable: true, cost: 50 },
    { key: 'tower_cannon', model: 'tower_cannon.glb', static: true, placeable: true, cost: 120 },
    { key: 'tower_frost',  model: 'tower_frost.glb',  static: true, placeable: true, cost: 90 },
  ],
  systems: [new WaveSystem(), new EconomySystem(), new TowerAttackSystem()],
  config: { fixedDt: 1 / 60 },               // 地面游戏默认重力
});
```

`main.ts` 里 `createGame(tower)` 一行接入。**换品类 = 换一份 `defineGame` 配置 + 换 systems + 换模型**，内核零改动。
品类开关示例——把 `map` 改 seeded、`units` 换飞机模型、`physics: 'air'` + `config: { gravity: 0 }`，就是飞行游戏；
把 `placeable` 单位换成载具 + `physics: 'vehicle'`，就是赛车。

### 3.2 内容包契约（`src/content/define.ts`，新建）

```ts
interface GameSpec {
  id: string;
  title: string;
  /** 相机：可写单模式（塔防）或多模式（开放世界骨架运行时切换） */
  camera: CameraMode | { default: CameraMode; allow: CameraMode[] };
  player: PlayerSpec;                      // model + physics mode + stats
  units: UnitDef[];                        // 单位表：模型 + 行为 + 数值 + 生成
  scene: (w: SceneBuilder) => void;        // 场景构建器
  systems: System[];                       // 玩法逻辑
  config: Partial<WorldConfig>;            // 重力/步长/尺寸，覆盖框架默认
  i18n?: Record<string, [string, string]>; // 中英，可选
}

type CameraMode = 'fps' | 'chase' | 'orbit' | 'free';
// CameraRig.setMode(mode)：allow 内任意切换；过渡用短时插值（位置/朝向 lerp），避免瞬移眩晕
// Sample A：'fps'（+坦克 chase 附带）；Sample B：'orbit'；Sample C：{ default:'chase', allow:['fps','chase','orbit'] }

interface PlayerSpec { model: string; physics: 'ground' | 'air' | 'vehicle'; stats: PlayerStats; }
interface UnitDef {
  key: string; model: string;
  hp?: number; static?: boolean;
  behavior?: 'idle' | 'patrol' | 'chase' | 'custom';
  behaviorFn?: (unit: Unit, world: EngineWorld, dt: number) => void; // 自定义行为
  spawn?: number;
}

function defineGame(spec: GameSpec): GameModule;  // 返回框架可挂载的 GameModule
```

关键设计：
- **`behaviorFn` 让塔防 / 赛车 / 飞行各自塞自己的单位行为**，不用改框架。
- **`physics` 三模式**：`ground`（FPS 骨架式 character controller）、`air`（飞行 3-DOF）、`vehicle`（载具）。
  这是「一个框架适配多品类」的核心开关。
- **`config` 覆盖默认**：飞行把 `gravity` 设 0，赛车调 `fixedDt`，全部走配置而非改代码。

### 3.3 地图三模式：一等公民，用户方自己选（本次核心诉求）

> 诉求：框架**同时内置两种（实为三种）地图方式**，内容作者按自己游戏挑，互不干扰。
> 三种模式在框架里统一为「地图 = 一种 `MapSpec` 描述」，菜单/联机按模式消费，**架构上干净、谁用谁付成本**。

| 模式 | `MapSpec` 形态 | 适合 | 质量上限 | 多样性 | 成本结构 | 验收载体 |
|---|---|---|---|---|---|---|
| `seeded` | `{ kind:'seeded', fn: (seed) => MapGen }`（程序化生成，同 seed 同图） | P2P 联机遭遇战、Roguelike、无尽模式 | 受生成算法封顶 | **无穷**（一个 seed 一个世界） | 运行时生成，零资产；**P2P 零带宽共享**（seed 字符串 = 整个世界） | Sample A FPS 骨架 |
| `fixed` | `{ kind:'fixed', assets: MapAsset[] }`（手工设计地图包，离线烘焙） | 战役、竞技场 PvP、赛车、塔防 | **最高**（美术可设计光位/掩体/POI） | 低（N 张图） | **离线烘焙**（含 navmesh），运行时零生成成本，内存可预测 | Sample B demo-tower |
| `stream` | `{ kind:'stream', chunks: ChunkDef[] }`（chunk 流式，走到哪载到哪） | 开放世界 / 大型休闲 / 开放世界骨架 | 最高（手工）+ 可无限扩展 | 中（大地图分区） | 流式加载 + 预取环；**本期最小可工作**（Sample C） | Sample C demo-cultivation |

```ts
// src/content/define.ts（MapSpec 契约）
type MapSpec =
  | { kind: 'seeded';  gen: (seed: number) => TerrainDesc }                       // FPS 骨架现状
  | { kind: 'fixed';   maps: FixedMapDef[] }                                      // 手工图包，菜单选图
  | { kind: 'stream';  root: string; chunk: number; lodRings: number[] };         // chunk 流式
interface FixedMapDef { id: string; terrain: TerrainDesc; navmesh?: string; spawn: SpawnDef[] }
interface TerrainDesc { /* 地形描述：尺寸/高度场/POI/掩体——seeded 与 fixed 共用 */ }
```

**FPS 骨架的落位（Sample A）**：
- 本次只走 `seeded` 模式（现状行为，不回归）——验证框架能承载"程序化地图 + P2P 联机"这一最复杂样本。
- `fixed` 模式（3-6 张手工图：夜战经典 + 开阔遭遇 + PvP 对称）= **FPS 骨架内容包的未来任务**，不在框架关键路径；
  框架只交付 `fixed` 的机制与接口（`FixedMapDef` 加载 + 离线烘焙工具链 + 菜单选图），由 sample 验证机制可用。

> **NPC 行为注记**：地图方式只影响"路线规划表示"（seeded 用 steering+物理滑移已够；fixed/stream 可叠加 navmesh）。
> NPC"像不像"的大头在 `Steering`（行为层）与视野感知，与地图模式正交——换地图方式不会让 NPC 变好，升级 Steering 才会。

> **成本注记**：`fixed`/`stream` 的质量上限收益来自**美术工时**（手工图是设计工时，seeded 是"免费"的）。
> 框架只提供机制（MapSpec + 离线烘焙工具链 + 流式加载），**手工图本身是内容，归 L3 内容包制作**，不是框架交付。

> **stream 升级注记（2026-09-13 三样例增补）**：Sample C 要求 `ChunkWorld` **最小可工作**——
> 能加载 2–3 个 chunk、玩家移动时按需加载/卸载、远处 chunk 降 LOD 或用简化网格；
> 不要求预取环调优到 MMORPG 水准，不要求 navmesh 搭车（Steering+GridAStar 覆盖 Sample C 寻路）。

---

## 4. 迁移路线（每步 tsc + test + build 三重验证，不跳步）

> 原则：每阶段结束 `npm run typecheck && npm test && npm run build` 全绿 + FPS 骨架可玩，才进下一步。
> FPS 骨架行为「前后一致」是红线——重构不许改手感。
> **📋 分步施工单**（每步的做法/验收/回滚/预计规模）见 `EXECUTION_STEPS.md`；本节的 Phase 为战略层，
> 施工以 `EXECUTION_STEPS.md` 为准，两者冲突时以施工单为准。

### Phase 0 — 前沿技术基线（先定底座，后面解耦直接按新基线写）
> 目标：把 L1 内核升级到「WebGPU 唯一 + 标准 rapier3d + 压缩资产」，**不向下兼容**。
> **状态：切片 1/2 完成 ✅ · 切片 3（资产管线）待做**——分步施工单见 `EXECUTION_STEPS.md`。
- **渲染** ✅：`createEngineAsync` 删 WebGL2 回退与 `?renderer=webgl` 开关 → WebGPU 唯一；无 adapter 给出明确错误页（「本框架需 WebGPU」）。
- **物理** ✅（方案修正）：`rapier3d-compat` → `@dimforge/rapier3d` 标准包（独立 .wasm）；实测官方**无多线程 JS 构建** → 多线程列未来扩展位；**不开 COOP/COEP**；测试管线用 esbuild alias → compat。
- **构建** ✅：`vite` `build.target` → `esnext`。
- **资产** ⬜（切片 3）：纹理转 KTX2（Basis）；模型转 Draco/Meshopt；一次性 `scripts/assets-encode.mjs` 工具链。
- **画质** ⬜（延后）：WebGPU 后期链 + GPU 粒子，挂 `QualityController` 分档。
- 当前验证基线：tsc 0 / 测试 20/20 / build 0 警告 / 浏览器回归 WebGPU 75 FPS 0 错误（2026-09-13）。
- ⚠️ 代价前置确认：① 删 WebGL 回退 = 老设备直接打不开（已拍板接受）；② 标准 wasm 需 HTTP 服务（file:// 不行——本就部署网页端）。

### Phase A — 从最复杂样例抽出内核（框架主轴的关键战役）
> **目的不是「重构FPS 骨架」，而是「把与游戏无关的逻辑从 Sample A 里抽出来变成框架」。**
> FPS 骨架是现成的、最复杂的压力样本（FPS+联机+载具）——用它当手术台，抽出后FPS 骨架自己降级为普通内容包。
把 `core/game.ts` 的 `Game` 大脑按职责拆成真实 System，FrameSystems 从转发壳变成实壳：
- `MovementSystem`（player 位移/姿态）、`CombatSystem`（武器/AI/命中）、`VehicleSystem`（tank/jeep）、
  `MissionSystem`（任务/胜负）、`WeatherSystem`（天空/云/探照灯）、`NetSystem`（联机同步）、
  `EffectsSystem`（VFX）、`HUDSystem`（UI）、`AtmosphereSystem`、`RenderPresentSystem`。
- `Game` 类瘦身为「持有 services + 实体 + 屏态」的宿主，不再 own 循环。
- **脱敏纪律**：搬到 L2 的部分去掉FPS 骨架专名；留在 `src/game/nightraid/` 的才是 Sample A 私有。
- 验证：`?debug=1` 自测脚本（`scripts/selfcheck_full.mjs` + `game_state_check.mjs`）像素/状态断言不回归。

### Phase B — 通用构件上移到 L2 `src/blocks/`（框架独立于任何样例）
> **只把「另一个不相干的游戏也要用」的东西上移**；Sample A 私有（士兵外观/坦克/吉普/FPS 骨架 HUD）留在内容包。
> 上移前必须**脱敏**：去掉FPS 骨架专名，改为参数/接口。
- `player/player.ts` → `blocks/Unit`（配置驱动：半径/高度/速度全从 `PlayerSpec` 注入，不再硬读 `CONFIG`）。
- `world/tank.ts`、`world/jeep.ts` → 内容包私有（Sample A 载具），但 `blocks/` 提供 `VehicleBase`。
- `world/terrain.ts` + `mapgen.ts` → `blocks/SceneBuilder` 的可复用地形/生成器。
- **`MapBuilder` 落地三模式**：`seeded`（现有 mapgen 改造成 `gen(seed)` 注入，行为不变）、`fixed`（`FixedMapDef` 加载 + 离线资产校验）、`stream`（`ChunkWorld` 最小可工作，Sample C 验收）。
- 对象池（muzzle light / flare / casings）→ `blocks/Pool`。
- `physics/world.ts`、`player.ts` 去掉对 `CONFIG` 的直接 import，改为构造参数注入。
- 验证：Sample A 手感不变 + `test/` 六项单测全绿 + 同 seed 地图与改造前逐点一致（mapgen 确定性回归测试）。

### Phase C — 内容包 API 落地，Sample A 改用 `defineGame` 重表达
> **里程碑含义**：FPS 骨架从「唯一游戏」降级为「框架上的一个普通内容包」——与 B/C 平级，只是目录名不同。
- 新建 `src/content/define.ts`、`SceneBuilder`、`UnitDef`、`MapSpec` 类型。
- 把 Sample A 改写为 `src/game/nightraid/define.ts`（一份 `defineGame` 配置 + 系统集），`MapSpec` 走 `seeded` 模式（现状行为）。
- `main.ts` 改为 `createGame(nightraidSpec)`，删掉 `core/game.ts` 的 `Game` 大脑（已拆空）。
- 验证：Sample A 完整可玩 + 联机 e2e（`net_e2e.mjs`）+ PvP。
- ⚠️ 范围外（移出关键路径）：Sample A 的 `fixed` 手工图、音频瘦身 = **该内容包自己的未来任务**，不阻塞框架完工。

### Phase D — 验收样例 B：demo-tower（框架成立的第一证明）
> 形态（2026-09-13 拍板）：**塔防**（Sample A 已覆盖 FPS 第一视角，Sample B 换品类以验证更多框架路径）。
- 新建 `src/game/demo-tower/`：一个**只用框架 + 积木、零其他样例代码**的最小塔防：
  - `MapSpec.fixed`：1 张**手工设计图**（草地 + 固定敌道 + 塔位点）——同时充当 `fixed` 机制「≥1 张示例图」的验证载体（一鱼两吃）；
  - `camera: 'orbit'`：斜俯视 rig（L2 现成）；
  - 敌人沿 `Path` 样条走（L2 现成）；放塔交互用内核射线拾取；
  - 玩法 System：波次生成、经济（击杀得钱）、塔的攻击逻辑（`behaviorFn`/自定义 System）；
  - 胜负状态走内核状态机（`playing → over`）。
- `?game=tower` URL 切换加载；跑起来即证明「不碰内核就能做另一个品类」。
- **这是开源前必须交付的验收标准之一**——它跑通，框架才算真成立（fixed+Path+orbit 路径）。
- 形态边界（保持最小）：3 种塔（速射/慢伤/减速）+ 3-5 波 + 基地 HP；HUD 只要「金钱/波次/基地血量」三读数，不做完整胜负结算页。

### Phase E — 验收样例 C：demo-cultivation（三样例补全：stream + 多视角）
> 形态（2026-09-13 用户增补）：**开放世界骨架开放世界**（小规模 ARPG 观感，非真·MMO 架构）。
> **美术（用户拍板）**：另找/做一批开放世界骨架 GLB（修士/妖兽/山林小场景）；E1–E2 机制验收用占位几何，E3 起换正式模型，避免「等美术」堵死框架路径。
- 新建 `src/game/demo-cultivation/`：**只用框架 + 积木、零其他样例代码**的最小开放世界骨架场景：
  - `MapSpec.stream`：2–3 个 chunk 的小开放世界（山林+修炼台+小村），玩家走动触发加载/卸载——**ChunkWorld 最小可工作**的验收载体；
  - `camera: { default:'chase', allow:['fps','chase','orbit'] }`：**运行时键位切换**（1/2/3），CameraRig `setMode()` + 平滑过渡验收；
  - 玩家：第三人称 ground 控制器（Sample A 的 fps 控制器对照，验证 physics:ground 的视角无关性）；
  - 玩法最小链：修炼点交互（站桩涨修为条）+ 1–2 种游荡妖兽（Steering + GridAStar 绕障追击）+ 简易飞剑/法术攻击（Effects 复用）；
  - 昼夜：若 L2 已抽出 day/night 则复用；否则单时段即可，不阻塞；
  - HUD 最小：修为条 + 境界文字 + 当前视角模式。
- `?game=cultivation` URL 切换加载。
- **联机**：可选加分（P2P 小房间合作）；若延期，单机可玩即算 Sample C 达标，不阻塞框架完工。
- **这是开源前必须交付的验收标准之一**——它跑通，证明 stream+多视角路径成立。
- 形态边界（保持最小）：不做任务系统/背包/装备/技能树/交易；不做无缝大世界；不做专用服务器。

### Phase F — 开源打包
- npm workspace 或单包多入口：`@yexi/core`（L1）、`@yexi/blocks`（L2）、`@yexi/content`（L3 契约 + 示例）。
- 模板仓库 `game-template`：`defineGame` 空骨架 + 三套示例 spec 对应三样例路径（fps/塔防/开放世界骨架多视角占位），别人 fork 即填。
- 文档：`docs/QUICKSTART.md`（10 分钟上手）、`docs/API.md`（三层契约）、`docs/ADAPT.md`（**多品类各一页**：FPS/塔防/开放世界骨架多视角/飞行/赛车——证明框架适配各种三维游戏）。
- README 顶部放「框架能做什么」+ 三样例在线链接（三样例平级展示，无主从）。

---

## 5. 验收标准（Definition of Done）

| 项 | 标准 |
|---|---|
| **样例互相独立** | `src/game/nightraid/`、`demo-tower/`、`demo-cultivation/` **两两之间零 import**（grep 验收）；框架 `engine/`+`blocks/` **零反向依赖**任一样例（grep 验收） |
| 内核零改动 | demo-tower 与 demo-cultivation 全程不改 `engine/`、`blocks/` 一行代码（相对 Phase C 后的基线 diff） |
| 三样本可跑 | Sample A + B + C 各自可玩；互不依赖；赛车/飞行 spec 骨架可加载（证明 API 装得下更多品类） |
| 地图三模式机制可用 | `seeded`（Sample A）+ `fixed`（Sample B，≥1 张示例图）+ `stream`（Sample C，ChunkWorld 最小可工作） |
| 运行时相机切换 | Sample C 可在 fps / chase / orbit 间键位切换且过渡平滑；Sample A/B 单模式行为不变 |
| 三重验证 | 每阶段 typecheck + test + build 全绿 |
| Sample A 不回归 | 自测脚本 + 联机 e2e 全绿，手感不变（它是内容包，不是框架，但不许在抽框架时弄坏） |
| 别人能填 | fork template → 改 `defineGame` → 起本地服务器看到**自己的**游戏（不依赖任一样例源码） |

---

## 6. 风险与代价

| 风险 | 等级 | 缓解 |
|---|---|---|
| Phase A 拆分 `Game` 大脑（2,347 行），重构面最大，易引入手感回归 | **高** | 逐系统拆成 10 个小步（见 `EXECUTION_STEPS.md` §2）；每步跑自测 + 快照回滚点；拆完再删，不边拆边删 |
| **项目无版本控制（无 git）= 大重构无回滚网** | **高** | `EXECUTION_STEPS.md` §0.1 快照机制：每步开工前 `_snapshots/<step>/` 全量拷贝（一条命令），失败即拷回；可选：本地 git 仅作安全网（不推远端） |
| `CONFIG` 被 20+ 文件直接 import，改注入式要动很多文件 | 中 | Phase B 用「参数注入 + 默认值回退」渐进迁移，不一次性全改 |
| 联机（net/）与内容耦合：P2P 协议写死FPS 骨架单位 | 中 | 联机归 L2 可选能力，协议按「Unit 快照」泛化；FPS 骨架专属事件走内容包 |
| 范围膨胀：想一次做完所有品类 | — | 只保证三样例（fps / 塔防 / 开放世界骨架最小）可玩，赛车/飞行仅交 spec 骨架，不交成品 |
| **Sample C 被做成「真 MMO」而失控** | **高（已设红线）** | 品类观感≠架构：不做专用服务器/无缝大世界/持久化；联机仅可选 P2P 小房间；ChunkWorld 只做 2–3 chunk 最小可工作 |
| **运行时相机切换引入手感/眩晕问题** | 中 | `setMode` 用短时 lerp 过渡；Sample A 的 fps 与坦克 chase 先做回归，再在 Sample C 接三模式 |
| **Phase 0 删 WebGL 回退 = 老设备/老 Safari 打不开** | **高（已拍板接受）** | 启动页明确「本框架需 WebGPU」+ 浏览器版本提示；这是「不向下兼容」的既定代价 |
| **音频 22MB 占 dist 74%（用户拍板：归FPS 骨架内容包，不进框架 Phase 0）** | 中（不阻塞框架） | 框架 DoD 不含音频瘦身；FPS 骨架内容包任务：dist 只发 ogg/m4a、wav 不进包；README 注明样例体积现状 |
| **Sample C 依赖外部开放世界骨架 GLB** | 中 | E1–E2 用占位几何验收 ChunkWorld/相机；E3 换正式 GLB；美术延期只影响观感，不阻塞机制验收 |
| **WebGPU 无 render.info，性能对账失明** | 中 | 记入已知问题；L1 可选扩展位补 WebGPU 诊断面；不阻塞三样例 |
| **标准 rapier3d 的 wasm 需独立文件加载** | 低（已解决） | 浏览器构建走 Vite 原生 wasm 处理（独立缓存）；Node 测试管线 esbuild alias → compat；`file://` 不可用（本就网页部署）；多线程需未来自建编译（扩展位） |
| **KTX2/Draco 资产转码工具链** | 中 | 一次性 `scripts/assets-encode.mjs`；转码失败资产回退原格式（开发期），不阻塞 |
| WebGPU 后期链/GPU 粒子是帧率杀手 | 中 | 全部挂 `QualityController` 分档，低配自动降 CPU 路径；按档验收帧率 |
| `fixed` 手工图的质量收益 = 美术工时，不是框架能白送的 | 中 | 框架只交付机制（MapSpec + 离线烘焙工具链 + 流式加载）+ ≥1 张示例图验证机制；FPS 骨架 3 张手工图 = FPS 骨架内容包未来任务，不占框架关键路径 |
| 地图三模式增加框架接口面（MapSpec 复杂度） | 低-中 | 三模式在 B/C/E 阶段落地：seeded/fixed 在 B/C，stream 最小可工作在 E（Sample C）；后续只加内容不动接口 |

---

## 7. 术语表

| 词 | 含义 |
|---|---|
| 内核 L1 | 与具体游戏无关的底座：循环/物理/渲染/输入/音频/资产/事件 |
| 积木 L2 | 通用游戏构件：单位/生成器/相机/对象池/特效/寻路 |
| 内容包 L3 | 别人填的：GameSpec + 系统 + 单位表 + 场景 + 配置 |
| `defineGame` | 内容包入口，把 spec 变成框架可挂载的 GameModule |
| `physics: ground/air/vehicle` | 单位物理三模式，是「一个框架适配多品类」的核心开关 |
| `behaviorFn` | 单位自定义行为钩子，让塔防/赛车/飞行各自塞 AI |
| 寻路三件套 | `Path`（固定路线）/ `Steering`（怎么走得自然）/ `GridAStar`（任意目标绕障）；"真实感"= 路线+转向+平滑三者组合，A\* 单独不真实 |
| `MapSpec` 三模式 | `seeded`（程序化，同 seed 同图，P2P 零带宽共享）/ `fixed`（手工图包，离线烘焙，质量上限最高）/ `stream`（chunk 流式，走到哪载到哪，开放世界/开放世界骨架）；三种地图方式框架全内置，内容作者自选 |
| `NavMesh` | 第 3 档可选件：把可走区域烘焙成凸多边形网络，A\*+funnel 在"面片图"上搜；生成重（离线/做图时）、运行时查询亚毫秒；本期仅接口位（Sample C 用 Steering+GridAStar，不依赖 NavMesh） |
| `ChunkWorld` | chunk 加载/预取环/远处 LOD 的标准件；Sample C 要求**最小可工作**（2–3 chunk）；navmesh 与地形搭同一加载顺风车为未来能力 |
| 验收样例 | B=demo-tower（塔防，证 fixed+Path+orbit）；C=demo-cultivation（开放世界骨架，证 stream+运行时相机切换）；两者都是「框架成立」的证据 |

---

## 8. 已定 / 待你拍板

**已定（你已拍板）**
- ✅ 技术基线：WebGPU 唯一 + **标准 rapier3d（独立 wasm）** + KTX2/Draco + 最新 three + `esnext` 构建，**不向下兼容老设备**（Phase 0；多线程列未来扩展位——官方无多线程 JS 构建，2026-09-13 实测修正）。
- ✅ 引擎留在 three.js，不上 Babylon.js（迁移=全量重写，违背铁律）。
- ✅ **地图三模式一等公民**：框架同时内置 `seeded`（程序化）/ `fixed`（手工离线烘焙）/ `stream`（chunk 流式），内容作者按游戏自选（见 3.3）。
- ✅ **寻路三件套**：`Path`（标准件）+ `Steering`（标准件，从FPS 骨架 AI 抽出）+ `GridAStar`（可选件）；`NavMesh` 为第 3 档可选件（开放世界/MMORPG 档，本期仅预留接口位，不做实现）。

**已定（2026-09-13 全部拍板，规划定稿 · 三样例增补）**
1. ✅ **范围**：Phase 0→E 做到「WebGPU 下 Sample A（FPS 骨架）+ Sample B（demo-tower）+ Sample C（demo-cultivation）能跑 + 三重验证全绿」即框架完工；Phase F 开源打包另开任务。
2. ✅ **Sample B 形态**：**demo-tower 塔防**（最小可玩：3 种塔 + 3-5 波 + 基地 HP + 三读数 HUD；同时充当 `fixed` 机制验证载体）——Sample A 已覆盖 FPS 第一视角，Sample B 换品类验证更多框架路径（`MapSpec.fixed` + `Path` + `Steering` + `orbit` 视角 + 波次/经济系统）。
3. ✅ **Sample C 形态（2026-09-13 增补）**：**demo-cultivation 开放世界骨架开放世界**（最小可玩：stream 2–3 chunk + 运行时 fps/chase/orbit 切换 + 第三人称 ground + Steering/GridAStar 妖兽 + 修炼点交互；**非真 MMO 架构**，联机可选）——验证 `MapSpec.stream` 与 `CameraRig.setMode` 两条路径。
4. ✅ **包结构**：先**单仓多目录**（`engine/`、`blocks/`、`content/`、`game/` 目录边界即包边界），npm 拆包等确认开源时再做。
5. ~~✅ **COOP/COEP**：Cloudflare Pages 顶层部署~~ → **已作废（2026-09-13 实测修正）**：标准 rapier3d 同为单线程，**不需要 COOP/COEP**，部署零额外约束；`public/_headers` 保持现状。

**已定（2026-09-13 深度审查拍板）**
6. ✅ **音频不进框架 Phase 0**：22MB 音频归**FPS 骨架内容包**任务（dist 只发 ogg/m4a）；框架完工判定不含音频瘦身。
7. ✅ **Sample C 美术 = 另找/做开放世界骨架 GLB**（不程序化凑合、不改FPS 骨架资产）；E1–E2 占位几何先验收机制，E3 换正式 GLB。
8. ✅ **Phase A 前 `git init` 本地仓**（不推远端），每步一 commit；与 `_snapshots` 双保险。
9. ℹ️ **WebGPU 诊断面**列为 L1 可选扩展位（无 `render.info`），不阻塞三样例。

**技术基线核验（2026-09-13 对 npm registry）**

| 包 | 项目内 | registry 最新 | 结论 |
|---|---|---|---|
| `three` | ^0.186.0 | 0.186.0 | ✅ 已最新（2026-09-08 发布） |
| `@dimforge/rapier3d` | ^0.20.0 | 0.20.0 | ✅ 已最新（2026-08-08 发布） |
| `typescript` | ^7.0.2 | 7.0.2 | ✅ 已最新 |
| `playwright` | ^1.63.0 | 1.63.0 | ✅ 已最新 |
| `@types/three` | ^0.186.0 | 0.186.0 | ✅ 已对齐 |
| `vite` | ^8.3.0 | 8.3.0 | ✅ 已对齐 |
| `wrangler` | ^4.131.1 | 4.131.1 | ✅ 已对齐 |
| 资产工具链（切片 3 引入） | — | gltf-transform 4.5 / meshoptimizer 1.2 / ktx-parse 2.0 | 可用 |

> 对齐后验证：typecheck EXIT=0 / 单测 20/20 / build 0 错误（仅 three chunk>500kB 体积提示，属预期）。
> 「锁定最新」原则：后续每次 Phase 收尾检查一次 registry；major 升级需单独评估 release note。
>
> **深度审查补充事实**：dist 30.2MB 中音频 22.3MB（约 74%）；`WebGPURenderer` 无 `render.info`（Engine.ts:177），drawCalls 恒为 0。
