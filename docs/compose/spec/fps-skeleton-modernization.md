---
feature: fps-skeleton-modernization
status: delivered
updated: 2026-09-13
branch: feature/fps-modernize
commits: 657543243c33a4dc94d7744c2f2c74a8b37dda9e..eadc3c207e2f2c314ba06c85dee6c81e977d0e1d
---

# FPS Skeleton Modernization

## Report

**What was built** — Added a minimal first-person **FPS arena skeleton** (`fps-arena`) that uses only framework blocks (Cooldown, pickTarget, Pool, Scoreboard, kit placeholders). Entry `fps-arena.html`, package `src/game/demo-fps-arena`, recipe `--recipe fps-arena`. Full campaign demo `fps.html` / `nightraid` is unchanged and remains the advanced path. Docs and hub now describe dual FPS entries: light arena + full demo.

**Verification** — `npm run typecheck` PASS · `npm test` PASS (44) · `npm run build` PASS · `node scripts/probe-all.mjs` PASS (all entries including fps-arena). Reviewer: approve, no critical findings; N1–N6 polish applied in follow-up commit.

**Journey log** —
1. Full `index.html` was briefly replaced by a minimal shell and broke the night-raid demo; restored from git history (`e93eb7a`).
2. Hub `GENRES` was corrupted by a partial string replace; rewrote the whole array.
3. `CameraRig` in fps mode only applies yaw — recipes that own pitch/position should not leave an unused rig (`void rig`).
4. Prefer worktree + spec + probe-all before claiming skeleton work done.

## [S1] Problem

The full FPS demo (`src/game/nightraid`, entry `fps.html`) is the heaviest sample and still reads like a single monolithic product rather than a **skeleton** in the KeeL 3D story. New users who open the FPS path get a large campaign codebase, not a minimal first-person loop they can copy.

## [S2] Design

### Delivered
- `fpsArenaRecipe` — WASD + mouse/arrow look + hitscan, daylight, autoPlay, camera fps
- `fps-arena.html` + registry `fpsarena` + vite input + `--recipe fps-arena`
- Dual FPS docs: README / RECIPES / hub / USER_GUIDE
- probe-all covers `#fps-arena-hud`
- No imports from `game/nightraid`

### Contracts (as shipped)

```ts
fpsArenaRecipe({
  id: string; title?: string;
  moveSpeed?, lookSpeed?, fireCd?, bulletDamage?,
  targetHp?, spawnEvery?, arena?, eyeHeight?
})
```

## [S3] Out of Scope

- Rewriting `nightraid` gameplay
- Multiplayer
- npm publish / domain deploy

## Tasks

- [x] T1: fps-arena recipe — typecheck; no nightraid import (covers: S2)
- [x] T2: demo-fps-arena + fps-arena.html + registry/vite (covers: S2; depends: T1)
- [x] T3: RECIPES / hub / README / USER_GUIDE dual FPS (covers: S2; depends: T2)
- [x] T4: probe-all fps-arena (covers: S2; depends: T2)
- [x] T5: typecheck/test/build/probe green (covers: S2; depends: T1-T4)
