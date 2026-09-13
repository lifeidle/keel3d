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

```ts
import { HudPanel } from '../../blocks/ui/HudPanel';
const hud = new HudPanel({ id: 'my-hud', position: 'tl' });
hud.setText(`金币 ${eco.balance}`);
// dispose() 时 hud.dispose()
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
