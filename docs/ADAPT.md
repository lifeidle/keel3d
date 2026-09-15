# ADAPT — KeeL 3D 换品类一页纸

> **KeeL 3D** · https://keel.specul.com  
> 换游戏 = 换一份 `defineGame` + systems + 模型。内核与积木零改动。

## FPS（Sample A 路径）

- `camera: 'fps'`
- `map: { kind: 'seeded', gen }`
- `physics: ground` + `createUnitBody`
- 联机可选：复用 `src/net/` 协议（L2 可选能力）

## 塔防（Sample B 路径）

- `camera: 'orbit'`
- `map: { kind: 'fixed', maps: [FixedMapDef] }`
- 敌人 `Path` 跟线；放塔用射线拾取
- 无玩家体；经济/波次写在自己的 System

## 开放世界骨架开放世界（Sample C 路径）

- `camera: { default: 'chase', allow: ['fps','chase','orbit'] }`
- `map: { kind: 'stream' }` + `ChunkWorld`
- 妖兽 `Path` + `Steering`；复杂绕障加 `GridAStar`
- 键位 1/2/3 → `CameraRig.setMode`

## 飞行（spec 骨架）

```ts
defineGame({
  id: 'flight',
  camera: 'chase',
  map: { kind: 'seeded', gen: skyWorld },
  player: { model: 'plane.glb', physics: 'air' },
  config: { gravity: 0, fixedDt: 1 / 60 },
});
```

## 赛车（spec 骨架）

```ts
defineGame({
  id: 'race',
  camera: { default: 'chase', allow: ['chase', 'orbit'] },
  map: { kind: 'fixed', maps: [trackDef] },
  player: { model: 'car.glb', physics: 'vehicle' },
});
```

## 独立性检查清单

- [ ] `src/game/<you>/` 不 import 其他 `game/*`
- [ ] 不改 `src/engine/`、`src/blocks/`
- [ ] 专有名词（士兵/坦克/HUD 文案）留在你的目录
- [ ] `npm test` + `npm run typecheck` + `npm run build` 全绿
