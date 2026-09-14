# 积木手册 — KeeL 3D 按需拼装

> **原则**：要用哪块就 import 哪块；不要的不进包、不进帧循环。  
> 推荐精确路径：`from '../../blocks/gameplay/Health'`（避免整包 barrel 误拖）。

## 玩法积木 `src/blocks/gameplay/`

| 模块 | 用法 | 适用 |
|---|---|---|
| `Health` | `new Health({ max, onDeath })` · `damage/heal/revive` | 任何有血单位 |
| `Timers` | `after` / `every` · `update(dt)` | 冷却、延时 |
| `Economy` | `add` / `spend` / `canAfford` | 金币、资源 |
| `Scoreboard` | `kills` / `wave` / `add(key)` | 计分、HUD |
| `WaveDirector` | 波次表 + `spawnFn` · `update(dt)` | 塔防、生存 |
| `PlaceGrid` | `snapFree` / `occupy` / `release` | 放塔、建筑 |
| `Spawner` | 单位表 + `create` · `spawn` / `damage` / `reap` | 通用刷怪 |

### 最小塔防拼法（示意）

```ts
import { Economy } from '../../blocks/gameplay/Economy';
import { WaveDirector } from '../../blocks/gameplay/WaveDirector';
import { Health } from '../../blocks/gameplay/Health';

const eco = new Economy({ start: 100 });
const waves = new WaveDirector({
  waves: [{ count: 5, interval: 0.5, delay: 2, unit: 'grunt' }],
  spawnFn: (w) => spawnGrunt(w.unit!),
});
// create() 里手动 systems.push({ update: (ft) => { waves.update(ft); eco... } })
```

完整可运行版见 `src/game/demo-tower/index.ts`。

## UI 积木 `src/blocks/ui/`

| 模块 | 用途 |
|---|---|
| `HudPanel` | 角标文字面板（tl/tr/bl/br） |
| `Toast` | 短提示 |
| `EndOverlay` | 胜/负叠层 |
| `HealthBar` | 2D 血条（可用 `setHp`） |
| `PauseMenu` | 暂停菜单：Esc / 手柄 Start，继续 / 重开 / 回 hub。暴露 `paused` 状态供配方门控 sim |
| `ControlsOverlay` | 开局操作浮层，底部居中，默认 6 秒自动隐藏（点击也可关闭） |

```ts
import { HudPanel } from '../../blocks/ui/HudPanel';
const hud = new HudPanel({ id: 'my-hud', position: 'tl' });
hud.setText(`金币 ${eco.balance}`);
// dispose() 时 hud.dispose()
```

**体验壳**（每个配方都该接；见 `docs/compose/spec/controls-shell.md`）：

```ts
import { PauseMenu } from '../../blocks/ui/PauseMenu';
import { ControlsOverlay } from '../../blocks/ui/ControlsOverlay';

const pause = new PauseMenu({ active: () => status === 'playing' });
const controls = new ControlsOverlay({
  hints: [{ keys: ['W', 'A', 'S', 'D'], label: '移动' }, { keys: ['Esc'], label: '暂停' }],
});

// 1) systems 里追加：pause.system, controls.system
// 2) sim 门控：if (world.playing && status === 'playing' && !pause.paused)
//    键盘/点击回调里直接改玩法的，也要各加一道 if (pause.paused) return;
// 3) dispose() 里：pause.dispose(); controls.dispose();
```

## 空间/世界积木（既有）

`Path` · `Steering` · `GridAStar` · `CameraRig` · `ChunkWorld` · `MapBuilder` · `createSeededTerrain` · `Pool`

## 配方 recipes

- `towerDefenseRecipe` · `npm run new-game x -- --recipe td`
- `survivalRecipe` · `npm run new-game x -- --recipe survival`
- 源码：`src/recipes/`

## 不同游戏要配多少？

| 类型 | 你通常只写 |
|---|---|
| 塔防变体 | 塔表数值 + 美术；波次/经济/放置用积木 |
| 波次生存 | 敌人表 + 胜利条件；Wave + Health + Steering |
| 俯视收集 | 触发规则 + 资源文案 |
| 开放世界 | chunk 内容生成函数 |
| FPS 战役 | 武器/任务（可参考 Sample A，不必整包继承） |

**专属 System 通常 0–3 个**；其余是数据。

## 注册约定

- **不要**在宿主里自动 `new` 这些积木  
- 只在 `GameSpec.create()` 里构造并 `systems.push`  
- 未 push 的模块会被打包器摇掉（无顶层副作用）


## 交互积木 `src/blocks/interact/`

| 模块 | 用途 |
|---|---|
| `TriggerZone` | 球/盒触发：onEnter/onExit/onStay |
| `Pickup` / `PickupField` | 拾取（自动或手动） |
| `Interactable` | F 键交互：距离 + 次数 + 冷却 |

```ts
import { PickupField, Pickup } from '../../blocks/interact/Pickup';

const gems = new PickupField([
  new Pickup({ id: 'a', x: 10, z: 6, radius: 1.6, onCollect: () => score++ }),
]);
// 每帧
gems.update(player.x, player.z);
```

开放世界骨架已演示：走近金色灵珠自动拾取；中央台为 TriggerZone。

## 进度积木 `src/blocks/progress/`

| 模块 | 用途 |
|---|---|
| `SaveSlot` | 版本化 localStorage 存档 |
| `BestScoreSlot` | 最佳成绩（圈速等） |


## 战斗积木 `src/blocks/combat/`

| 模块 | 用途 |
|---|---|
| `Cooldown` | 技能/射击间隔 |
| `Magazine` | 弹匣/备用弹/换弹计时（纯逻辑） |
| `Arsenal` | 多槽武器簿记：弹药、冷却、切枪、后坐 |
| `pickTarget` | 最近 / 范围内选敌 |
| `Projectile` + `stepProjectiles` | 弹道与命中 |
| `areaHits` / `ringHits` | AOE / 环形伤害 |

## 建造积木 `src/blocks/build/`

| 模块 | 用途 |
|---|---|
| `BuildSystem` | 建筑表、放置、升级、定时产出 |

## 进度（补充）

`LevelTable` — 关卡解锁链；赛车骨架已用 `BestScoreSlot` 存最佳圈速。


## UI（补充）

`DamageNumber` 飘字 · `MinimapDots` 小地图点

## 进度（补充）

`RunState` 单局统计快照


## 音频 `src/blocks/audio/`

| 模块 | 用途 |
|---|---|
| `SfxPlayer` | 一次性音效（无 AudioContext 时静默） |
| `BgmLayers` | calm/intense 双层交叉音量 |

## UI（补充 2）

`ButtonBar` 底栏按钮 · `QuestTracker` 任务列表

## kit（补充）

`kitPillar` · `kitPad`；`kitScatter` 已含更多变化

## 配方 × 积木接线一览

下列积木已在配方中**真实调用**（非仅 import），可直接对照源码：

| 配方 | 接入积木 |
|---|---|
| **arpg** | Health · Scoreboard · Economy · RunState · Cooldown · pickTarget · Projectile · **areaHits(旋风斩 K)** · Pickup · Steering · ButtonBar · QuestTracker · **HudPanel** · **HealthBar** · **DamageNumber** · **WorldBar** · **EndOverlay** · BgmLayers |
| **tower-defense** | Path · Pool · Economy · WaveDirector · Health · **PlaceGrid** · **Timers** · **BuildSystem/BuildCatalog(放塔+升级)** · **HudPanel** · **EndOverlay** · **Toast** |
| **fps-arena** | Pool · **Arsenal(弹匣/换弹)** · pickTarget · Scoreboard · **Health** · **HudPanel** · **HealthBar** · **DamageNumber** · **EndOverlay** · kitHumanoid |
| **dungeon** | Interactable · TriggerZone · Health · Scoreboard · **LevelTable** · **HudPanel** · **Toast** · **EndOverlay** · **MinimapDots** |
| **collect** | Pickup · TriggerZone · Scoreboard · **RunState** · **HudPanel** · **Toast** · **EndOverlay** |
| **survival** | Pool · Health · Economy · Scoreboard · WaveDirector · **Spawner** · **Timers** · Steering · **HudPanel** · **EndOverlay** |
| **rally** | Path · TriggerZone · BestScoreSlot · Scoreboard · **HudPanel** · **Toast** |

**粗体** = 本轮新接线。`SfxPlayer` 需 `AudioEngine`（配方无引擎句柄，暂不接）；`GridAStar` 当前无配方调用（地牢敌人是定点 Boss，无需寻路）；`ChunkWorld`/`MapBuilder`/`TerrainBuilder` 由 demo 骨架（openworld/template）使用。

## 自 nightraid 上移的积木

| 路径 | 模块 | 用途 |
|---|---|---|
| `blocks/fx/` | `ShellCasings` · `SmokeColumns` · `FireSites` · `CombatVfx` | 弹壳 · 烟柱 · 篝火 · 战斗特效 |
| `blocks/props/` | `Searchlight` · `ClothFlags` · `DestructibleCover` · `ExplosiveBarrel` · `VehicleHulk` | 探照灯 · 旗 · 木箱 · 油桶 · 残骸 |
| `blocks/scene/` | `TimeOfDay` · `Weather` · `Vegetation` | 昼夜 · 天气 · 植被 |
| `blocks/assets/` | `PhotoTex` | HD 贴图异步升级 |
| `blocks/audio/` | `SampleBank` · `ScoreDirector` | 样本库播放 · 情绪配乐 |
| `blocks/vehicles/` | `WheeledVehicle` · `TrackedVehicle` | 轮式/履带载具 |
| `blocks/ui/` | `TacticalMap` | 罗盘 + 战术小地图 |
| `blocks/player/` | `CharacterController` | 胶囊移动（跳/冲刺） |
| `blocks/input/` | `Gamepad` | 手柄输入 |
| `blocks/input/` | `TouchControls` · `isTouchDevice()` | 手机虚拟摇杆 + 全屏 look 面 + 可配置按钮簇（fps-arena / tps 已接） |

nightraid 只保留战役内容：`game.ts` · `enemy` · `player` · `SoldierFactory` · `mission` · `hamlet` · `gunmodels` · `hud` · `systems/*` · 薄 `audio/music` 包装（BANK 表仍在样例）。
