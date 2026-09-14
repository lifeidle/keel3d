# KeeL 3D — User Guide

> **KeeL 3D** · by [Specul](https://specul.com) · https://3d.specul.com · npm: `keel3d`  
> A browser-native **3D game foundation** (WebGPU + three.js + Rapier + TypeScript).

---

## 1. What this is

KeeL 3D is a **framework** for web 3D games. It owns the engine-shaped work that every game needs and that has nothing to do with “what your game is about”:

- Render loop + fixed-timestep physics  
- Input, quality tiers, dynamic resolution  
- Object pools, paths, steering, grid A*  
- First / third / orbit cameras (runtime `setMode`)  
- Three map modes: seeded · fixed · stream (chunks)  
- Optional P2P networking protocol (used by Sample A)

**You provide** theme, models, numbers, and a few `System`s (gameplay).

### What it is not

- Not Unity / Unreal: no visual editor, no asset store  
- Not “zero code”: you write some TypeScript  
- Not an MMO stack: networking is small-room P2P  
- **WebGPU required**: unsupported browsers get a clear upgrade message  

---

## 2. What you can build

Runnable paths already in the repo:

| Genre | Where | What you tweak |
|---|---|---|
| FPS (with co-op/PvP) | `src/game/nightraid` | missions, weapons, map seed |
| Tower defense | `src/game/demo-tower` + `--recipe td` | lane, towers, waves, gold |
| Open-world cultivation | `src/game/demo-cultivation` | chunks, cameras, mobs |
| Wave survival | `--recipe survival` | HP, waves, damage |
| Flight / racing skeletons | `demo-flight` / `demo-race` | track, custom systems |

**Outcome shape**: a static site (`dist/`) you can host anywhere; developers edit locally with `npm run dev`.

---

## 3. 30-minute start

### 3.1 Requirements

- Node.js ≥ 22  
- A **WebGPU** browser (recent Chrome / Edge, or Safari 17+)  

### 3.2 Run

```bash
npm install
npm run build
npm run preview
```

Then open (default ~`http://localhost:4173`):

| Path | What |
|---|---|
| `/hub.html` | Pick a genre → see base config + blocks |
| `/fps.html` | Full FPS demo |
| `/fps-arena.html` | Light FPS arena (recipe) |
| `/tower.html` | Tower defense |
| `/openworld.html` | Open world (keys 1/2/3 switch camera) |

### 3.3 Scaffold your own game

```bash
npm run new-game mygame -- --title "My Game" --html
npm run new-game mytd -- --recipe td --html
npm run new-game mysurv -- --recipe survival --html
```

Open `/mygame.html` (or your HTML entry). Edit `src/game/<id>/index.ts` and refresh.

### 3.4 Minimal content package

```ts
import { defineGame } from '../../content';
import { CameraRig } from '../../blocks/CameraRig';
import type { System } from '../../engine/types';

export default defineGame({
  id: 'mygame',
  title: 'My Game',
  daylight: true,
  camera: { default: 'chase', allow: ['fps', 'chase', 'orbit'] },
  create: (ctx) => {
    const rig = new CameraRig(ctx.camera, { defaultMode: 'orbit' });
    const systems: System[] = [{
      name: 'mygame.sim',
      update(ft, world) {
        rig.update(ft, ctx.scene.position, 0);
      },
    }];
    return { systems };
  },
});
```

Do **not** hand-edit business branches in `main.ts`. The scaffold registers your game in `src/registry.ts`.

---

## 4. Pay-for-what-you-use

Blocks live under `src/blocks/`. Import **only what you need**; unused modules should not ship or tick.

```ts
import { Economy } from '../../blocks/gameplay/Economy';
import { WaveDirector } from '../../blocks/gameplay/WaveDirector';
import { HudPanel } from '../../blocks/ui/HudPanel';
```

The host never auto-registers gameplay systems. Only systems you `push` inside `create()` run.

See [BLOCKS.md](./BLOCKS.md).

---

## 5. Docs map

| Doc | Purpose |
|---|---|
| [USER_GUIDE.md](./USER_GUIDE.md) | 中文完整指南 |
| [USER_GUIDE.en.md](./USER_GUIDE.en.md) | This file |
| [QUICKSTART.md](./QUICKSTART.md) | Step checklist (CN) |
| [API.md](./API.md) | Contracts (CN) |
| [BLOCKS.md](./BLOCKS.md) | Blocks & recipes (CN) |
| [LEGAL.en.md](./LEGAL.en.md) | License scope & disclaimer (EN) |
| [LEGAL.md](./LEGAL.md) | 法律说明（中文） |
| [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) | Third-party licenses & attributions |

---

## 6. Deploy

```bash
npm run build
# upload dist/ to any static host
```

Optional P2P signaling: Cloudflare Pages Functions (`functions/`, `wrangler.toml`).

---

## 7. FAQ

**Black screen / “WebGPU required”?**  
Use a current Chrome/Edge (or Safari 17+ with WebGPU).

**Edits not showing under `preview`?**  
`preview` serves `dist/` — rebuild after changes. Use `npm run dev` while iterating.

**Ship only my game, without Night Raid assets?**  
Do not copy Night Raid-only files under `public/audio` and `public/models`. Framework code remains MIT.

**Commercial use?**  
Yes — see [LEGAL.en.md](./LEGAL.en.md). A full Night Raid build must honor CC-BY attributions (and CC-BY-SA voice terms or removal).
