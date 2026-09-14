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
