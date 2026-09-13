# API — 三层契约

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
| `applyDaylight` / `addSunDisc` | 演示白天光照（非夜袭样例用） |

## L3 契约 `src/content/`

```ts
defineGame(spec: GameSpec, systems?: System[]): DefinedGame

interface GameSpec {
  id: string;
  title: string;
  camera: CameraMode | { default: CameraMode; allow: CameraMode[] };
  map?: MapSpec;           // seeded | fixed | stream
  player?: PlayerSpec;
  units?: UnitDef[];
  config?: Record<string, unknown>;
}

type MapSpec =
  | { kind: 'seeded'; gen: (seed) => unknown }
  | { kind: 'fixed'; maps: FixedMapDef[] }
  | { kind: 'stream'; root: string; chunk: number; lodRings: number[] };
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
