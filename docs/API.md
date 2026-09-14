# API — KeeL 3D 三层契约

> **KeeL 3D** · Specul · https://3d.specul.com  
> 框架维护 L1+L2，内容包只写 L3。样例目录之间禁止互相 import。

## L1 内核 `src/engine/`

| 导出 | 说明 |
|---|---|
| `Engine` | rAF 循环、fixed-dt 累加器、System 调度、`world.playing` |
| `createEngineAsync` | WebGPU 唯一启动（无 adapter 抛 `WebGpuRequiredError`） |
| `QualityController` | 画质档 + 动态分辨率 |
| `AssetHub` / `AudioEngine` | 资产与音频 |
| `Input` | 键鼠/触摸 |
| `createGltfLoader` / `modelUrl` | Draco + 可选 KTX2 模型加载 |

## L2 积木 `src/blocks/`

| 模块 | API 要点 |
|---|---|
| `Pool` | `acquire/release/releaseAll/forEachLive` |
| `Path` | `sampleAt/sampleDir/end/totalLen` |
| `Steering` | `seekDir/flankDir/separationDelta/limitSpeedXZ/normalizeXZ` |
| `GridAStar` | `blockWorld/findPath` |
| `CameraRig` | `setMode(fps\|chase\|orbit\|free)` + `update(dt, target, yaw)` |
| `Unit` | `createUnitBody(physics, {radius,height,spawn,tag})` |
| `ChunkWorld` | `update(focusX, focusZ)` 环加载；`loadedCount` |
| `MapBuilder` | `buildMap(spec, {seeded,fixed,stream}, ctx)` |
| `createSeededTerrain` | 通用地形高度场 + 可选物理 trimesh |
| `applyDaylight` / `addSunDisc` | 演示白天光照（非FPS 骨架样例用） |
| `Magazine` | `canFire/consume/startReload/tick` 弹匣状态机 |
| `Arsenal` | `update(dt,held,clicked)→FireOutcome` · `reload/switchTo/reset/refillAll` |
| `ShellCasings` / `SmokeColumns` / `FireSites` / `CombatVfx` | 弹壳 · 烟柱 · 火点 · 战斗特效（自 nightraid） |
| `Searchlight` / `ClothFlags` / `DestructibleCover` / `ExplosiveBarrel` / `VehicleHulk` | 场景道具 |
| `TimeOfDay` / `Weather` / `Vegetation` / `PhotoTex` | 昼夜/天气/植被/HD 贴图 |
| `SampleBank` / `ScoreDirector` | 样本音效库 · 情绪配乐 |
| `WheeledVehicle` / `TrackedVehicle` / `TacticalMap` | 载具与战术地图 |
| `LootTable` / `Inventory` / `FactionMap` | 掉落 · 背包 · 阵营 |
| `InventoryGrid` | DOM 背包格 |
| `CharacterController` | 共享胶囊移动：update/jump/sprint |
| `Gamepad` | 标准手柄 poll；无硬件时全 0 |

## L3 契约 `src/content/`

```ts
defineGame(spec: GameSpec): DefinedGame

interface GameSpec {
  id: string;
  title: string;
  daylight?: boolean;     // default true for demos; false keeps engine night look
  autoPlay?: boolean;     // default true → world.playing = true
  camera: CameraMode | { default: CameraMode; allow: CameraMode[] };
  map?: MapSpec;
  player?: PlayerSpec;
  units?: UnitDef[];
  create: (ctx: GameCreateContext) => GameInstance;
}

interface GameCreateContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  quality?: unknown;
  parent?: HTMLElement;
}

interface GameInstance {
  systems: System[];
  dispose?: () => void;
  stats?: () => Record<string, unknown>;
}

type MapSpec =
  | { kind: 'seeded'; gen: (seed) => unknown }
  | { kind: 'fixed'; maps: FixedMapDef[] }
  | { kind: 'stream'; root: string; chunk: number; lodRings: number[] };
```

**Host**：`mountSampleGame(mod, { engine, scene, camera, render, sun, hemi })`  
**Registry**：`src/registry.ts` — composition root, the only framework-side file allowed to import `game/*`.

```bash
npm run new-game mygame -- --title "My Game" --html
```

## System 契约

```ts
interface System {
  name: string;
  update?(ft: number, world: EngineWorld): void;
  fixedUpdate?(dt: number, world: EngineWorld): void;
  dispose?(): void;
}
```

注册顺序 = 执行顺序。`world.playing === false` 时 fixedUpdate 由内核跳过。


## 音频 / UI / kit 补充

| 模块 | 路径 |
|---|---|
| SfxPlayer / BgmLayers | `src/blocks/audio/` |
| ButtonBar / QuestTracker / WorldBar | `src/blocks/ui/` |
| kitHumanoid / kitScatter / kitPad / kitPillar | `src/blocks/kit/` |
