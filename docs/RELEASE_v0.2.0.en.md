# KeeL 3D v0.2.0 — GitHub Release notes (draft)

**KeeL 3D** is a WebGPU-first browser game framework. Build FPS, tower defense, open-world, flight, or racing prototypes by composing **opt-in building blocks** — without rebuilding the engine.

Site: https://3d.specul.com · npm: `keel3d` · License: MIT (code)

---

## Highlights

- **WebGPU-only** kernel (three.js + Rapier) — modern, no WebGL fallback  
- **L2 blocks** (pay-for-what-you-use): Pool, Path, Steering, GridAStar, CameraRig, Unit, ChunkWorld, MapBuilder, terrain, daylight  
- **Gameplay blocks:** Health, Timers, Economy, Scoreboard, WaveDirector, PlaceGrid, Spawner  
- **UI blocks:** HudPanel, Toast, EndOverlay, HealthBar  
- **Recipes:** tower defense + wave survival (`npm run new-game --recipe td|survival`)  
- **Scaffold:** `npm run new-game <id>` → registry + optional HTML  
- **Samples:** Night Raid FPS (co-op/PvP), tower defense, cultivation open world, flight/racing skeletons  
- **Hub page** (`hub.html`): pick a genre → see camera/map/blocks → play or scaffold  
- **33** unit tests · typecheck · production build  

---

## Quick start

```bash
npm install
npm run build && npm run preview
# open /hub.html
```

Requires a **WebGPU** browser (Chrome/Edge recent, Safari 17+).

```bash
npm run new-game mytd -- --recipe td --html
```

Docs: [USER_GUIDE.en.md](docs/USER_GUIDE.en.md) · [BLOCKS.md](docs/BLOCKS.md) · [API.md](docs/API.md)

---

## License

- Code: **MIT**  
- Bundled third-party audio/textures/models: see [THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md)  
- Disclaimer: [LEGAL.en.md](docs/LEGAL.en.md)  

Commercial use of the framework is allowed. If you redistribute a full Night Raid build, keep CC-BY attributions (see notices).

---

## Not in this tag

- npm multi-package publish  
- Visual editor  
- True MMO networking  
- WebGL fallback (by design)
