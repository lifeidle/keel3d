# Recipes — KeeL 3D

数据驱动骨架：改表即可玩；需要时再加 1–2 个 System。  
脚手架：`npm run new-game <id> -- --recipe <name> --html`

| Recipe | 入口页 | 操作 | 主要积木 |
|---|---|---|---|
| `td` | tower.html | 1/2/3 选塔，点空台放置，U 升级 | Path · Wave · Economy · Health |
| `survival` | （new-game） | WASD 移动，撑过波次 | Wave · Health · Steering |
| `arpg` | arpg.html | WASD，空格/J 攻击，捡掉落 | Cooldown · pickTarget · Projectile · Pickup |
| `collect` | collect.html | WASD 捡满后回金圈 | PickupField · TriggerZone |
| `rally` | rally.html | 自动行驶，按序穿检查点 | Path · BestScoreSlot · TriggerZone |
| `dungeon` | dungeon.html | E/F 开门，Boss 房 J/空格 | Interactable · TriggerZone |
| `fps-arena` | fps-arena.html | WASD + 鼠标/方向键，空格/J 射击 | pickTarget · Pool · kit |
| `tps` | tps.html | WASD + 肩扛视角，Shift 跳，空格射击，手柄可用 | CharacterController · Gamepad · shoulder · Arsenal |
| `flight-arena` | flight-arena.html | WASD 飞行，空格/J 射击 | Projectile · pickTarget |
| `roguelike` | roguelike.html | 清房下潜，清首领进下一层 | ProcDungeon · LootTable · Inventory · SaveSlot |
| `platformer` | platformer.html | 跳平台登顶 | CharacterController · TriggerZone |
| `tycoon` | tycoon.html | 点地建造 | PlaceGrid · BuildSystem · Economy |
| `rts-lite` | rts.html | 选中下令 | FactionMap · Steering |
| `stealth` | stealth.html | 躲视锥守卫 | VisionCone · NoiseEmitter |
| `combat-arena` | arena.html | 载具对战 | Arsenal · areaHits · Gamepad |
| `rhythm` | rhythm.html | 空格打拍 | BeatClock |
| `sandbox` | sandbox.html | 点击放/拆方块 | VoxelChunk |
| `br-lite` | br.html | 毒圈生存 | ShrinkZone · Arsenal |
| `puzzle` | puzzle.html | 推箱解谜 | TriggerZone |
| `sports` | sports.html | 带球得分 | FactionMap · Scoreboard |

**全品类统一体验壳**：每个配方都接了 `blocks/ui/PauseMenu`（Esc / 手柄 Start 暂停，可继续 / 重开 / 回 hub）与
`blocks/ui/ControlsOverlay`（开局操作浮层，6 秒后自动隐藏）。fps-arena / tps 另外接了
`blocks/input/TouchControls`（手机虚拟摇杆 + FIRE / RELOAD）。加配方时照 `docs/compose/spec/controls-shell.md` 的接线表补这四行即可。

---

## td（塔防）

```ts
towerDefenseRecipe({
  id: 'mytd',
  lane: [{ x, y, z }, ...],
  pads: [{ x, z }, ...],
  startMoney: 100,
  baseHp: 20,
  // towers / waves 可省略用默认表
})
```

| 字段 | 含义 |
|---|---|
| `lane` | 敌人路径折线 |
| `pads` | 可放塔圆台中心 |
| `startMoney` | 初始金币 |
| `baseHp` | 基地血量 |
| `towers` | 塔表 `{ key,cost,range,rate,damage,color }` |
| `waves` | 波次 `{ count,interval,delay }` |

## survival（波次生存）

```ts
survivalRecipe({ id: 'mysurv', playerHp: 100 })
```

| 字段 | 含义 |
|---|---|
| `playerHp` / `moveSpeed` | 玩家 |
| `waves` / `enemyHp` / `enemySpeed` | 敌潮 |
| `contactDamage` / `contactRange` | 近身伤害 |

## arpg（俯视）

```ts
arpgRecipe({ id: 'myarpg' })
```

近战优先，远处发弹；击杀掉金币拾取。

## collect（收集）

```ts
collectRecipe({ id: 'mycol', count: 8, arena: 28 })
```

| 字段 | 含义 |
|---|---|
| `count` | 目标数量 |
| `arena` | 场地半宽 |
| `parTime` | 预留参考时间 |

## rally（拉力）

```ts
rallyRecipe({ id: 'myrally', checkpoints: 4, speed: 14 })
```

按序穿过光圈后冲线才计完整圈；最佳圈写入 localStorage。

## dungeon（地牢）

```ts
dungeonRecipe({ id: 'mydgn', rooms: 3 })
```

| 字段 | 含义 |
|---|---|
| `rooms` | 房间数（最后一间为 Boss） |
| `playerHp` / `moveSpeed` | 玩家 |

## fps-arena（轻量第一人称）

```ts
fpsArenaRecipe({ id: 'myfps', targetHp: 50 })
```

WASD 移动 · 鼠标（点击锁定）或方向键转向 · 空格/J 射击。完整战役演示见 `fps.html`。

| 字段 | 含义 |
|---|---|
| `moveSpeed` / `lookSpeed` | 移动与视角 |
| `fireRate` / `bulletDamage` | 射击（发/秒） |
| `magSize` / `reserve` / `reloadTime` | 弹匣与换弹 |
| `targetHp` / `spawnEvery` / `arena` | 靶场 |

## flight-arena（空战）

```ts
flightArenaRecipe({ id: 'myfa', spawnEvery: 2.2, droneHp: 20 })
```

---

## 通用约定

- 配方 **默认导出** `defineGame(...)`，宿主自动挂 present/daylight  
- 不需要的积木不会进你的包（精确 import）  
- 可把 `src/recipes/*.ts` 整份拷进 `src/game/<id>/` 自行改写  


## 怎么玩 / 胜负条件

| 配方 | 操作 | 胜 | 负 |
|---|---|---|---|
| roguelike | WASD · 空格攻击 · E 喝药 · I 背包 | 无尽：清首领下潜（记录最深层） | HP 归零 |
| arpg | WASD · 空格/J · K 旋风斩 · I 背包 | 击杀 12 | HP 归零 |
| td | 1/2/3 选塔 · 左键放/升 · 右键卖 | 清完波次 | 基地被毁或超时 |
| collect | WASD | 限时收满回金圈 | 时间到 |
| platformer | WASD · 空格/Shift 跳 | 登顶 | 3 命用尽 |
| fps-arena | WASD · 空格/J 射击 · R 换弹 | 击杀 15 | HP 归零 |
| tps | WASD · Shift 跳 · 空格/J | 击杀 12 | HP 归零 |
| rts-lite | 左键选 · 右键令 | 消灭红方 | 蓝方全灭 |
| stealth | WASD · 空格噪声 | 抵达出口 | 被持续发现 |
| combat-arena | WASD · 空格主炮 · K 冲击 | 击落 10 | 载具被毁 |
| br-lite | WASD · 射击 | 存活到最后 | 阵亡 |
| tycoon | 1/2/3 建筑 · 点空地 | 人口 50 | — |
| puzzle | WASD 推箱 | 箱上金点 | — |
| sports | WASD 推球 | 先到 3 球 | 对方先到 3 |
| rhythm | 空格/J 卡拍 | 连击 20 | — |
| sandbox | 点击/X/1-5 | 放置 10 块 | — |

结束画面均支持 **R 重开**（除注明外）。
