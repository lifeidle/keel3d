# KeeL 3D

**Browser-native 3D game foundation** (WebGPU + three.js + Rapier + TypeScript).  
Part of [Specul](https://specul.com) · Site: https://3d.specul.com · npm: `keel3d`

Stop rebuilding the engine. Clone, fill in **models + gameplay + scene**, and ship FPS, tower defense, open-world, flight, racing, and more — as static web games.

| | |
|---|---|
| Rendering | **WebGPU only** (three.js r186; no WebGL fallback) |
| Physics | Rapier3D (standard wasm) |
| Stack | TypeScript + Vite |
| License | MIT (code) · see third-party notices for assets |

> Requires a WebGPU browser (recent Chrome / Edge, Safari 17+). Others see an upgrade message.

**English docs:** [User Guide](docs/USER_GUIDE.en.md) · [Legal](docs/LEGAL.en.md) · [Third-party notices](docs/THIRD_PARTY_NOTICES.md)  
**中文文档：** [使用指南](docs/USER_GUIDE.md) · [法律说明](docs/LEGAL.md) · [Quickstart](docs/QUICKSTART.md)

---

## What you get

| You no longer build | KeeL 3D provides |
|---|---|
| Render loop / fixed-step physics | `Engine` |
| Quality tiers + dynamic resolution | `QualityController` |
| Keyboard / mouse / touch | `Input` |
| Pools, paths, steering, A* | `Pool` · `Path` · `Steering` · `GridAStar` |
| FPS / chase / orbit + runtime switch | `CameraRig.setMode` |
| Character capsule | `createUnitBody` |
| Chunk streaming | `ChunkWorld` |
| Maps: seeded / fixed / stream | `MapBuilder` |
| Draco / KTX2 model load | `createGltfLoader` |
| Optional P2P protocol | `src/net/` |

---

## Quick start

```bash
npm install
npm run build && npm run preview
```

| URL | Game |
|---|---|
| `/hub.html` | Genre picker → base + blocks |
| `/` | Night Raid (FPS sample) |
| `/tower.html` | Tower defense |
| `/cultivation.html` | Open world (1/2/3 camera) |

### New game

```bash
npm run new-game mygame -- --title "My Game" --html
npm run new-game mytd -- --recipe td --html
npm run new-game mysurv -- --recipe survival --html
```

---

## Architecture

```
src/engine/     L1 kernel
src/blocks/     L2 building blocks (opt-in import)
src/content/    L3 GameSpec / defineGame / host
src/registry.ts composition root (only place that may load game/*)
src/game/*      independent content packages (no cross-imports)
```

---

## License & compliance

- **Source:** MIT — commercial use OK; keep the license notice.  
- **Assets in `public/`:** CC0 / CC-BY / CC-BY-SA — **not** covered by MIT.  
- Full guide: [docs/LEGAL.en.md](docs/LEGAL.en.md) · [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md)

**Commercial:** Framework + your own game → MIT + dependency notices.  
Full Night Raid build → keep CC-BY credits; handle CC-BY-SA voice lines (attribute/SA or remove).
