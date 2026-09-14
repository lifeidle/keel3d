# KeeL 3D — 全品类覆盖清单与补齐路线

> 目标：像搭积木一样做出各种网页 3D 游戏。  
> 许可策略：**全部自研 MIT**；不 vendoring 来路不明的第三方玩法代码。素材若引入只接受 **CC0 / MIT / Apache-2.0**，并写入 `docs/THIRD_PARTY_NOTICES.md`。  
> 现状基线：`master` @ extract-combat 合入后；`feature/extract-rest` 待合入（fx/props/vehicles/Weather/TimeOfDay/SampleBank/TacticalMap）。

---

## 1. 品类 × 现状矩阵

| 品类 | 状态 | 已有 | 还缺 |
|---|---|---|---|
| FPS | ✅ 覆盖 | fps-arena · nightraid 完整战役 | — |
| 第三人称 TPS | 🔶 部分 | chase 相机 | 肩扛相机 + tps 配方 |
| 塔防 TD | ✅ | td 配方 + demo-tower | demo 与配方统一 |
| 波次生存 | ✅ | survival | — |
| 俯视 ARPG | ✅ | arpg（AOE/任务/掉落） | Inventory · XP · Dialogue |
| Roguelike | ❌ | LevelTable 雏形 | ProcDungeon · Loot · Meta 存档 · roguelike 配方 |
| 地牢爬行 | 🔶 | dungeon 固定房 | 程序化房 · 背包 · 战利品 |
| 开放世界 | 🔶 | ChunkWorld + openworld | 任务链 · 生物群落 · 快速旅行 |
| 竞速 | ✅ | rally · race | 车辆对战钩子 |
| 飞行 / 空战 | ✅ | flight · flight-arena | — |
| 平台跳跃 | ❌ | — | CharacterController 跳跃/边缘 · 2.5D 相机 · platformer 配方 |
| 物理益智 | 🔶 | Rapier 已有 | 铰链/杠杆/推箱 helper · puzzle demo |
| 城建 / 模拟经营 | 🔶 | PlaceGrid · Economy · BuildSystem | 分区 · 工人/资源链 · tycoon 配方 |
| RTS | 🔶 | Path · GridAStar · Steering | 框选 · 编队 · 生产队列 · 迷雾 |
| 潜行 | ❌ | — | 视锥 VisionCone · 噪声源 · 巡逻 · stealth 配方 |
| 体育 | ❌ | — | 球体物理封装 · 队伍计分 · sports demo |
| 派对小游戏 | 🔶 | netplay 2 人 | 通用大厅 · 小游戏宿主 |
| 恐怖步行 | 🔶 | Weather · TimeOfDay（待合） | 手电/黑暗 · 对话 · 恐怖配方 |
| 体素 / 沙盒 | ❌ | — | VoxelChunk 编辑（可后置） |
| 音游 | ❌ | — | BeatClock · 判定窗（可后置） |
| 卡牌 / 桌游 3D | ❌ | — | 回合机 · 手牌 UI（可后置） |
| 载具对战 | 🔶 | Wheeled/Tracked（待合） | combat-arena 配方 |
| BR-lite | 🔶 | 2 人联机 + 竞技场 | 毒圈 · 拾取刷新 · 小队 |
| 银河恶魔城 | ❌ | LevelTable | 能力门 · 地图存档（可后置） |

图例：✅ 有配方且可玩 · 🔶 有积木无完整配方 · ❌ 缺关键积木

---

## 2. 待合入（本周零成本）

`feature/extract-rest`（已验证 62 测 / probe 全绿）：

| 积木 | 解锁 |
|---|---|
| ShellCasings · SmokeColumns · FireSites · CombatVfx | FPS/ARPG 打击感 |
| Searchlight · ClothFlags · DestructibleCover · ExplosiveBarrel · VehicleHulk | 场景与可破坏 |
| TimeOfDay · Weather · Vegetation · PhotoTex | 开放世界/恐怖氛围 |
| SampleBank · ScoreDirector | 任意游戏可播样本音效/配乐 |
| WheeledVehicle · TrackedVehicle | 载具对战 / 模拟 |
| TacticalMap | RTS / 战术 HUD |

**建议动作**：先 merge `feature/extract-rest` → master。

---

## 3. P0 积木（多品类共用，优先）

### 3.1 CharacterController — `blocks/player/CharacterController.ts`

胶囊体 + Rapier；地面检测、跳跃、冲刺、斜坡、台阶。  
输入：`{ moveX, moveZ, jump, sprint }`（键鼠/手柄统一）。  
**解锁**：FPS · TPS · 平台 · 恐怖 · 开放世界。

```ts
new CharacterController(physics, opts: { radius, height, eyeHeight, speed, jumpSpeed, sprintMul })
controller.update(dt, input, cameraYaw) → { grounded, velocity }
controller.teleport(x,y,z)
```

### 3.2 Gamepad — `blocks/input/Gamepad.ts`

标准映射：摇杆 → move/look，扳机 → fire，肩键 → 技能。  
**解锁**：所有动作类游戏的主机手感。

```ts
const pad = new Gamepad();
pad.poll(); // 每帧
pad.moveX / pad.moveY / pad.lookX / pad.lookY / pad.fire / pad.btn('a')
```

### 3.3 Inventory — `blocks/gameplay/Inventory.ts` + `blocks/ui/InventoryGrid.ts`

槽位、堆叠、装备槽、拾取/丢弃、序列化。  
UI：网格 DOM，拖拽可选。  
**解锁**：ARPG · Roguelike · 生存 · 开放世界。

```ts
const inv = new Inventory({ slots: 24, stackLimit: 99 });
inv.add({ id: 'potion', qty: 3 });
inv.equip('weapon', item);
const grid = new InventoryGrid(inv, { parent, onUse });
```

### 3.4 LootTable — `blocks/gameplay/LootTable.ts`

权重掉落、保底、次数限制。与 Spawner/击杀钩子组合。  
**解锁**：搜打撒 · ARPG · Roguelike。

```ts
const loot = new LootTable([
  { id: 'gold', weight: 70, qty: [5, 20] },
  { id: 'potion', weight: 25, qty: [1, 2] },
  { id: 'sword', weight: 5, qty: 1 },
]);
loot.roll() → ItemStack[]
```

### 3.5 Faction — `blocks/gameplay/Faction.ts`

队伍 id、敌对矩阵、`isHostile(a,b)`。与 Targeting/pickTarget 过滤。  
**解锁**：RTS · 多阵营 ARPG · BR 小队。

### 3.6 肩扛相机 — 扩展 `CameraRig`

`setMode('shoulder')`：偏移肩后 + 准星对齐 + 遮挡拉近。  
**解锁**：TPS 配方。

---

## 4. P1 积木（内容深度）

| 积木 | 路径 | 用途 |
|---|---|---|
| Dialogue | `blocks/gameplay/Dialogue.ts` + `ui/DialogBox.ts` | 节点树、选项、条件旗标 |
| XpProgress / SkillTree | `blocks/progress/` | 等级、技能点、解锁 |
| ProcDungeon | `blocks/world/ProcDungeon.ts` | 房间图 + 走廊 + 种子 |
| Craft | `blocks/gameplay/Craft.ts` | 配方表 + 材料校验 |
| VisionCone | `blocks/ai/VisionCone.ts` | 视锥+遮挡射线（潜行） |
| NoiseEmitter | `blocks/ai/NoiseEmitter.ts` | 半径事件 |
| BeatClock | `blocks/audio/BeatClock.ts` | BPM 网格（音游） |
| VoxelChunk | `blocks/world/VoxelChunk.ts` | 体素编辑（沙盒） |

---

## 5. 新配方（每品类一条最快路径）

| 配方 | 依赖积木 | 入口 |
|---|---|---|
| **tps** | CharacterController · shoulder 相机 · Arsenal · HealthBar | `tps.html` |
| **roguelike** | ProcDungeon · LootTable · Inventory · Xp · SaveSlot | `roguelike.html` |
| **platformer** | CharacterController(jump) · Path 平台 · TriggerZone | `platformer.html` |
| **tycoon** | PlaceGrid · Economy · BuildSystem · Timers · HudPanel | `tycoon.html` |
| **rts-lite** | Faction · GridAStar · Steering · 框选 · TacticalMap | `rts.html` |
| **stealth** | VisionCone · NoiseEmitter · CharacterController | `stealth.html` |
| **combat-arena** | Wheeled/Tracked · Arsenal · Health · AreaDamage | `arena.html` |
| **horror** | TimeOfDay · Weather · Dialogue · CharacterController | `horror.html` |
| **puzzle-physics** | Rapier 铰链 helper · TriggerZone | `puzzle.html` |
| **sports-lite** | 球体封装 · 队伍 Faction · Scoreboard | `sports.html` |

每条配方：独立 HTML · `new-game --recipe <id> --html` · 零互相 import · HUD 积木化。

---

## 6. 分阶段路线图

| 阶段 | 内容 | 退出标准 |
|---|---|---|
| **R0** | merge extract-rest | master 绿 |
| **R1** | CharacterController + Gamepad + 肩扛相机 + tps 配方 | tps probe 绿 |
| **R2** | Inventory + InventoryGrid + LootTable + Faction | 单测 ≥ 现有+10；ARPG 可选接背包 |
| **R3** | roguelike 配方（ProcDungeon 最小 + Loot + Inventory） | roguelike.html 可玩一局 |
| **R4** | Dialogue + Xp/SkillTree；horror 或 arpg 深度接线 | 文档 + probe |
| **R5** | platformer + tycoon 配方 | 两入口 probe 绿 |
| **R6** | rts-lite + stealth（VisionCone） | 两入口 probe 绿 |
| **R7** | combat-arena（载具）+ hub/README 全品类卡片 | hub 与 RECIPES 对齐 |
| **R8** | 可选：BeatClock 音游 · Voxel 沙盒 · BR-lite 毒圈 | 按需 |

---

## 7. 开源与商用约束（执行纪律）

1. **玩法/框架代码**：一律本仓库自研，MIT。禁止整文件抄袭第三方游戏逻辑。  
2. **算法参考**：可读公开论文/博客/伪代码后重写实现；不贴 GPL/SSPL 源码。  
3. **可引入依赖**（npm，已有或将来）：MIT / Apache-2.0 / BSD / ISC / CC0。  
4. **美术/音频**：仅 CC0 或明确可商用许可；记入 `THIRD_PARTY_NOTICES.md` + `AUDIO_CREDITS.md`。  
5. **禁止**：GPL/AGPL/SSPL 传染性许可、无许可 GitHub 仓库、需付费授权的素材。  
6. CI 建议：`license-check` 脚本扫描 `package-lock` 传递依赖许可（后续 R 阶段加）。

---

## 8. 与「搭积木」叙事对齐

| 用户问题 | 路线图答案 |
|---|---|
| 能不能做 XX 游戏？ | §1 矩阵：✅ 直接配方；🔶 拼积木；❌ 等 §3–5 |
| 缺什么工具？ | §3 P0 / §4 P1 积木清单 |
| 最快做出新类型？ | §5 一条配方 + `new-game --recipe` |
| 多久？ | §6 按阶段；R1–R2 约一轮 Compose；R3–R7 每轮 1–2 品类 |

---

## 9. 建议的下一轮 Compose 切入

**优先：R0 merge extract-rest → R1 CharacterController + Gamepad + shoulder + tps 配方。**  
理由：P0 里唯一能立刻多开一个品类（TPS）且被平台/恐怖/开放世界复用；Gamepad 成本低收益全品类。

spec 建议名：`feature/char-tps`（R1）或 `feature/p0-core`（R1+R2）。

---

## 10. 详细施工计划（如何把内容全部补全）

> 每一轮 = 一次 Compose Next（worktree → spec → 实现 → verify → review → merge）。  
> 轮内任务可并行时用子代理；**提交归编排者**。  
> 验收门禁每轮相同：`typecheck` · `test` · `build` · `probe-all` · `unused:check` 不回归。

### R0 — 合入 extract-rest（半天，零新功能）

| 步骤 | 动作 | 验收 |
|---|---|---|
| R0.1 | master merge `feature/extract-rest`（已验证 62 测） | master 绿 |
| R0.2 | 删 worktree/分支；push origin | 干净 |
| R0.3 | 跑一次 `unused:check` 记基线 | 数字入档 |

**依赖**：无。**风险**：低（分支已 delivered）。

---

### R1 — 移动与视角基线（TPS 解锁）

**Compose feature**：`feature/char-tps`

#### W1.1 CharacterController

| 项 | 内容 |
|---|---|
| 路径 | `src/blocks/player/CharacterController.ts` |
| 依赖 | Rapier `PhysicsWorld`（现有 `src/physics/world.ts`）；**不** import game/、不 import config（opts 注入） |

```ts
export interface CharCtrlOpts {
  radius?: number;      // default 0.35
  height?: number;      // capsule total, default 1.7
  speed?: number;       // default 6.5
  sprintMul?: number;   // default 1.7
  jumpSpeed?: number;   // default 8.5
  stepHeight?: number;  // default 0.35
  airControl?: number;  // 0..1, default 0.3
}
export interface CharInput { moveX: number; moveZ: number; jump: boolean; sprint: boolean }
export class CharacterController {
  constructor(physics: PhysicsWorld, opts?: CharCtrlOpts);
  readonly position: THREE.Vector3; // feet
  get grounded(): boolean;
  get velocity(): THREE.Vector3;
  /** move relative to cameraYaw (radians). */
  update(dt: number, input: CharInput, cameraYaw: number): void;
  teleport(x: number, y: number, z: number): void;
  setMesh(obj: THREE.Object3D): void; // sync visual
  dispose(): void;
}
```

实现要点：动态胶囊 + 胶囊 cast 地面；跳跃仅 grounded；冲刺乘 speed；斜坡用法线夹角。  
**测试** `test/charctrl.test.ts`：构造不抛（Node 用 mock physics 或跳过物理——若 PhysicsWorld 必须 wasm，则测试只测输入缩放/状态机纯函数部分，拆 `applyMoveIntent` 纯函数）。  
**验收**：typecheck；纯函数单测绿。

#### W1.2 Gamepad

| 路径 | `src/blocks/input/Gamepad.ts` |
|---|---|

```ts
export class Gamepad {
  poll(): void; // 每帧；无手柄时全 0
  get connected(): boolean;
  get moveX(): number; get moveY(): number; // 左摇杆，死区 0.15
  get lookX(): number; get lookY(): number; // 右摇杆
  get fire(): boolean; get altFire(): boolean;
  btn(id: 'a'|'b'|'x'|'y'|'lb'|'rb'|'start'|'select'): boolean;
}
```

**测试**：无 `navigator.getGamepads` 时 poll 不抛、全 0。  
**验收**：typecheck + 单测。

#### W1.3 CameraRig shoulder 模式

- `CameraMode` 增加 `'shoulder'`
- `update`：目标点后方偏移 `{dx: 0.6, dy: 1.5, dist: 4}`；准星向前；遮挡用短 raycast 拉近（可选 opts）
- **测试**：模式切换 lerp 不抛；文档 API.md 一行

#### W1.4 tps 配方

| 路径 | `src/recipes/tps.ts` · 入口 `tps.html` · registry `tps` |
|---|---|

```ts
tpsRecipe({ id, title?, moveSpeed?, sprintMul?, fireCd?, bulletDamage?, targetHp? })
```

- 玩家：CharacterController + kitHumanoid
- 相机：CameraRig `shoulder`
- 射击：Arsenal 1 槽 + pickTarget 前向
- HUD：HudPanel · HealthBar · DamageNumber · EndOverlay
- 目标：Pool + kitHumanoid 会反击（抄 fps-arena 模式）

**接线**：registry.ts · vite.config 输入 · probe-all 增加 `#tps-hud` · RECIPES.md · hub 卡片 · BLOCKS.md  

**R1 退出**：typecheck/test/build/probe-all 绿；tps 页可 WASD+射击；手柄插入后摇杆有响应（人工可选）。

---

### R2 — 战利品与背包基线

**Compose feature**：`feature/loot-inv`

#### W2.1 LootTable

`src/blocks/gameplay/LootTable.ts`

```ts
export interface LootEntry { id: string; weight: number; qty?: number | [number, number]; }
export interface ItemStack { id: string; qty: number }
export class LootTable {
  constructor(entries: LootEntry[], opts?: { rng?: () => number; rolls?: number });
  roll(times?: number): ItemStack[];
  rollOne(): ItemStack | null;
}
```

**测试**：权重分布粗测（1000 次）；qty 范围；空表 → []。

#### W2.2 Inventory

`src/blocks/gameplay/Inventory.ts`

```ts
export interface InvItem { id: string; qty: number; meta?: Record<string, unknown> }
export class Inventory {
  constructor(opts: { slots: number; stackLimit?: number });
  add(item: InvItem): number; // 返回未放入数量
  remove(id: string, qty: number): boolean;
  count(id: string): number;
  slots: readonly (InvItem | null)[];
  equip(slot: 'weapon'|'armor'|'trinket', item: InvItem | null): void;
  get equipped(): Record<string, InvItem | null>;
  serialize(): string; restore(json: string): void;
  onChange?: () => void;
}
```

**测试**：堆叠/满仓/装备/序列化。

#### W2.3 InventoryGrid UI

`src/blocks/ui/InventoryGrid.ts` — DOM 网格；`mount(parent)`；点击 onUse/onDrop；无 DOM 安全。

#### W2.4 Faction

`src/blocks/gameplay/Faction.ts`

```ts
export class FactionMap {
  setHostile(a: string, b: string, on?: boolean): void;
  isHostile(a: string, b: string): boolean;
}
```

与 `pickTarget`：`TargetCandidate` 已有结构，配方传入 `faction` 字段过滤（在 tps/arpg 演示一行）。

#### W2.5 ARPG 可选接线

- 击杀 `LootTable.roll()` → Pickup 或 Inventory.add
- ButtonBar 增「背包」开关 InventoryGrid  
**验收**：probe arpg HUD 仍在；背包 DOM `#inv-grid` 存在。

**R2 退出**：新单测 ≥ 10；typecheck/test/build/probe 绿。

---

### R3 — Roguelike 一局可玩

**Compose feature**：`feature/roguelike`

#### W3.1 ProcDungeon 最小

`src/blocks/world/ProcDungeon.ts`

```ts
export interface RoomDef { id: string; x: number; z: number; w: number; h: number; kind: 'start'|'combat'|'loot'|'boss' }
export interface DungeonLayout { rooms: RoomDef[]; corridors: Array<{ a: string; b: string }> }
export function generateDungeon(seed: number, opts?: { roomCount?: number }): DungeonLayout;
```

网格房间 + L 走廊；同 seed 可复现。  
**测试**：同 seed 相同 layout；连通性（BFS 房间图连通）。

#### W3.2 roguelike 配方

`src/recipes/roguelike.ts` + `roguelike.html`

- generateDungeon → kit 地板/墙（PlaceGrid 或手摆）
- CharacterController 第三人称或 orbit 移动
- 敌：Spawner + Steering + Health + LootTable → Inventory
- 门：Interactable；Boss 房 EndOverlay
- SaveSlot：`keel3d-rogue-meta` 最深层数（可选）
- HUD：层数 · 金币 · 背包按钮

**退出**：进房 → 清怪 → 拾取 → 开门 → Boss → 结算；probe `#rogue-hud`。

---

### R4 — 叙事与成长

**Compose feature**：`feature/dialogue-xp`

| 积木 | API 摘要 |
|---|---|
| `Dialogue.ts` | 节点 `{id, lines, options[{text,next,flag?}]}`；`start(id)` · `choose(i)` · `onEnd` |
| `DialogBox.ts` | DOM：一句一行 · 选项按钮 · Esc 关 |
| `XpProgress.ts` | `addXp` · `level` · `nextAt` 曲线 opts |
| `SkillTree.ts` | 节点 `{id, cost, requires?}`；`unlock(id)`；serialize |

**接线**：horror 或 arpg 演示对话；arpg 击杀加 XP，升级 Toast。  
**测试**：对话走分支；XP 升级阈值；技能前置未满足不可解锁。

---

### R5 — 平台 + 城建

**Compose feature**：`feature/platform-tycoon`

#### platformer

- CharacterController：`allowDoubleJump?`、土狼时间 0.1s
- 场景：Path/手摆平台 kit 块
- 目标：TriggerZone 旗；死亡重置
- 相机：chase 或固定 2.5D（`CameraRig` 增加 `side` 模式可选）

#### tycoon

- PlaceGrid 分区（住宅/商业/工业 id）
- BuildSystem 消耗 Economy；Timers 产出
- 需求：简易「人口/幸福」数字（RunState 自定义键）
- HUD：金钱/人口/时间

**退出**：两 HTML probe 绿；new-game --recipe platformer|tycoon。

---

### R6 — RTS-lite + 潜行

**Compose feature**：`feature/rts-stealth`

#### RTS-lite

| 新积木 | `blocks/ai/BoxSelect.ts` — 屏幕矩形 → 世界单位列表（raycast 地面） |
|---|---|
| 配方 | 右键下令 → GridAStar/Steering；Faction 两队；生产点 BuildSystem 简化；TacticalMap |

#### 潜行

| `VisionCone.ts` | `canSee(from, yaw, fov, range, targets, occludeRay?)` |
|---|---|
| `NoiseEmitter.ts` | `emit(x,z,radius)` → 已注册 listener |
| 配方 | 守卫巡逻 Path；玩家 CharacterController；被看见 → 警戒条 WorldBar；任务 TriggerZone |

**测试**：canSee 锥角内外；Noise 半径触发回调。

---

### R7 — 载具对战 + 全站对齐

**Compose feature**：`feature/arena-hub`

- `combat-arena` 配方：WheeledVehicle 或 TrackedVehicle（extract-rest）+ Arsenal 主炮 + AreaDamage + Health + EndOverlay
- hub.html：全品类卡片（含 tps/roguelike/platformer/tycoon/rts/stealth/arena/horror）
- README / RECIPES / BLOCKS / API 与 probe-all 列表同步
- `new-game --recipe` 支持新 recipe 名（scripts/new-game.mjs 表）

---

### R8 — 可选加深（按需单开 Compose）

| 项 | 积木 | 配方/demo |
|---|---|---|
| 音游 | BeatClock | rhythm.html |
| 体素 | VoxelChunk | sandbox.html |
| BR-lite | 毒圈（TriggerZone 环）+ LootTable 刷新 | br.html（可先 1 人） |
| 物理益智 | Hinge/Lever helper | puzzle.html |
| 体育 | BallBody + Faction 计分 | sports.html |
| 多人大厅 | 泛化 netplay（L） | 后置 |

---

## 11. 任务依赖图

```
R0 extract-rest merge
 └─ R1 CharacterController ─┬─ Gamepad
                            ├─ shoulder cam
                            └─ tps 配方
 └─ R2 LootTable ─ Inventory ─┬─ InventoryGrid
                              ├─ Faction
                              └─ ARPG 背包演示
         R1+R2 ─ R3 ProcDungeon ─ roguelike 配方
         R2    ─ R4 Dialogue/XP ─ arpg|horror 接线
         R1    ─ R5 platformer
         R2    ─ R5 tycoon
         R2 Faction + R1 ─ R6 rts-lite
         R1 CharCtrl     ─ R6 stealth
         R0 vehicles     ─ R7 combat-arena
         R1–R7           ─ R7 hub/docs 对齐
```

**可并行**：R1 的 Gamepad ∥ CharacterController；R2 的 Loot ∥ Faction ∥ Inventory；R6 两配方可并行子代理。

---

## 12. 每轮 Compose 检查单（执行模板）

1. `git status` master 干净 → worktree `.worktrees/<slug>`  
2. 写/改 `docs/compose/spec/<feature>.md`（本节 API 即 S2 草稿）  
3. 实现：积木 → 单测 → 配方 → registry/vite/probe/文档  
4. Verify：typecheck / test / build / probe-all / unused:check  
5. Review 子代理（spec 合规 · 正确性 · 一致性；禁止 import-only）  
6. Finalize spec → merge master → push → 清 worktree  

---

## 13. 工作量粗估

| 轮 | 内容 | 量级 |
|---|---|---|
| R0 | merge | 0.5d |
| R1 | CharCtrl+Gamepad+shoulder+tps | 1.5–2d |
| R2 | Loot+Inv+UI+Faction | 1.5d |
| R3 | ProcDungeon+roguelike | 2d |
| R4 | Dialogue+XP | 1.5d |
| R5 | platformer+tycoon | 2d |
| R6 | rts+stealth | 2–2.5d |
| R7 | arena+hub 对齐 | 1d |
| R8 | 可选项每项 | 1–2d |

**全补到 R7 ≈ 12–14 个工作日**（并行子代理可压缩日历时间）。

---

## 14. 验收总表（全部补完的 Definition of Done）

- [ ] §1 矩阵无 ❌ 行（或明确标为「永不做」并写 Out of Scope）
- [ ] 每个 ✅ 品类：独立 HTML + probe 选择器 + RECIPES 一行 + hub 卡片
- [ ] P0/P1 积木：有单测 + BLOCKS/API 文档 + 至少一处真实 call site
- [ ] `blocks/` 零 `game/` import；`game/*` 两两零 import
- [ ] typecheck / test / build / probe-all 全绿；unused:check 无「写了没人用」的 P0 积木
- [ ] 许可：无 GPL 依赖；新增 NOTICE 条目
- [ ] `npm run new-game x -- --recipe <每个新配方> --html` 可生成可编译骨架

