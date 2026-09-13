---
feature: fps-skeleton-modernization
status: in-progress
updated: 2026-09-13
branch: feature/fps-modernize
commits: # filled at delivery
---

# FPS Skeleton Modernization

## Report

## [S1] Problem

The full FPS demo (`src/game/nightraid`, entry `fps.html`) is the heaviest sample and still reads like a single monolithic product rather than a **skeleton** in the KeeL 3D story. New users who open the FPS path get a large campaign codebase, not a minimal first-person loop they can copy. Meanwhile every other skeleton (tower, open world, ARPG…) has a thin recipe or small demo that matches the “blocks + recipe” narrative.

Public docs and hub already say “FPS 骨架”, but the implementation path for FPS is not parallel to the other skeletons.

## [S2] Design

### Goals
1. Offer a **minimal FPS-like skeleton** (`fps-arena`) that uses framework blocks only — parallel to `arpg` / `collect` recipes.
2. Keep the full **advanced FPS demo** (`nightraid` / `fps.html`) as-is for “what a real game looks like”; do not rewrite its gameplay.
3. Align naming and docs: user-facing copy says **FPS 骨架**; code package may keep `nightraid` internally with an explicit alias note.
4. Maintain pay-for-what-you-use: the new recipe must not pull nightraid code.

### Contracts

**New recipe** `src/recipes/fps-arena.ts`:

```ts
fpsArenaRecipe({
  id: string;
  title?: string;
  moveSpeed?: number;
  lookSpeed?: number;
  fireCd?: number;
  bulletDamage?: number;
  targetHp?: number;
  spawnEvery?: number;
  arena?: number;
})
```

- Camera: `fps` (eye height ~1.6), yaw/pitch from pointer-like keys (or simple mouse look if pointer lock available; fallback: arrow keys / mouse drag).
- Movement: WASD on XZ, clamp to arena.
- Combat: ray/hitscan or short projectile; targets spawn on a ring; score kills.
- Uses only: CameraRig (fps), Cooldown, pickTarget or hitscan helper, Pool, Scoreboard, optional kit targets.
- Default export: `defineGame` with `daylight: true`, `autoPlay: true`.

**New entry** `fps-arena.html` + registry id `fpsarena` → `src/game/demo-fps-arena/`.

**Docs**:
- `RECIPES.md`: add `fps-arena` row + fields.
- `USER_GUIDE` / hub: FPS 骨架 → 「轻量 fps-arena」+「完整演示 fps.html」双入口说明。
- `README`: skeleton table lists both.

**Out of sample coupling**:
- `fps-arena` must not import `game/nightraid`.
- Full `nightraid` behavior unchanged (probe / regress still pass).

### Error behavior
- Missing WebGL/WebGPU: unchanged engine error page.
- No targets: HUD still shows score 0; spawn continues.

### Testing
- Unit: Cooldown/fire cadence optional; prefer probe of `fps-arena.html`.
- `npm run probe:all` includes `fps-arena`.
- `npm test` + typecheck + build green.
- Full FPS (`fps.html`) still loads (probe).

## [S3] Out of Scope

- Rewriting `nightraid` `game.ts` into more systems
- Multiplayer changes
- Asset kit expansion beyond using existing placeholders
- npm publish / domain deploy (user-side)

## Tasks

- [ ] T1: Implement `fps-arena` recipe — acceptance: typecheck; no import from nightraid (covers: S2)
- [ ] T2: Add `demo-fps-arena` package + `fps-arena.html` + registry/vite — acceptance: page loads with HUD (covers: S2; depends: T1)
- [ ] T3: Update RECIPES.md / hub / README dual FPS entries — acceptance: docs list fps-arena and fps.html (covers: S2; depends: T2)
- [ ] T4: Extend probe-all with fps-arena — acceptance: probe-all OK (covers: S2; depends: T2)
- [ ] T5: Full verify typecheck/test/build/probe — acceptance: all green (covers: S2; depends: T1-T4)
