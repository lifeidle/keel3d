---
feature: excellence
status: in-progress
updated: 2026-09-13
branch: feature/excellence
commits: # filled at delivery
---

# Excellence — block proof, recipe depth, quality gates, first-run polish

## Report

## [S1] Problem

The framework is usable but not yet excellent. Four gaps:

1. **Unproven blocks** — 19/40 blocks are never imported by any recipe or demo (`unused:check`). They typecheck but ship unproven; users cannot see how to wire them.
2. **Thin recipes** — skeletons read as tech demos, not copyable game starts. Missing HUD depth (health bars, damage numbers, end overlays), progression hooks, and small skill systems.
3. **Soft quality gates** — `noUnusedLocals` off repo-wide (nightraid legacy); `defineGame` accepted incomplete specs; unknown registry ids gave bare errors.
4. **First-run friction** — hub page and error UX do not match the "professional open-source base" story.

## [S2] Design

Ordered slices: **A quality/DX (finish started work) → B block wire-up + recipe depth → C hub/first-run**.

### Slice A — Quality & DX (partially landed, finish here)

| Item | Contract | Status |
|---|---|---|
| Quality gate policy | `docs/STRUCTURE.md`: noUnusedLocals stays off for nightraid; new code must stay clean | done |
| `defineGame` validate | Throw clear Error on missing id/title/create | done |
| `BaseRecipeOpts` | `{ id, title? }` shared type exported from defineGame | done |
| Registry unknown-id | Error lists known ids | done |
| Block unit tests | PlaceGrid / Spawner / LevelTable / RunState / defineGame | done |
| Wire `BaseRecipeOpts` into recipe opts interfaces | Recipes extend or inline-compatible | todo |
| STRUCTURE bundle budget note | Document ~5.4MB total + per-entry split | todo |

Acceptance: typecheck PASS; test ≥ 50 PASS; build PASS.

### Slice B — Block wire-up + recipe depth

Goal: every "possibly unused" block that belongs in a recipe is actually imported **and called** (not import-only). Each wire-up also deepens that recipe.

| Block | Wire into | Depth added |
|---|---|---|
| `DamageNumber` | arpg, fps-arena | floating damage on hits |
| `HealthBar` | arpg (player), fps-arena (player) | 2D HP bar HUD |
| `EndOverlay` | arpg, td, fps-arena, collect, dungeon, survival | replace ad-hoc end DOM with block |
| `HudPanel` | td, fps-arena, dungeon, collect, survival, rally | unified stats corner panel |
| `Toast` | collect (par), dungeon (door), td (wave clear) | short feedback |
| `WorldBar` | arpg | enemy HP bar above nearest target |
| `SfxPlayer` | arpg, fps-arena, collect | replace raw oscillator where easy; silent-safe |
| `AreaDamage` | arpg | AOE skill (key 2) using `areaHits` |
| `PlaceGrid` | td | snap pads to grid; occupy/release on place/sell |
| `BuildCatalog` | td | tower defs from catalog; BuildSystem place/upgrade/**remove(sell)** |
| `Spawner` | survival | unit table bookkeeping + wave-scaled HP |
| `Timers` | survival | HP regen every 4s via `every` |
| `LevelTable` | dungeon | room unlock chain + serialize |
| `RunState` | collect, arpg | per-run stats snapshot in end overlay |
| `MinimapDots` | dungeon | room/player dots minimap |
| ~~`GridAStar`~~ | — | skipped: dungeon boss is stationary; no pathfinding needed |
| ~~`SfxPlayer`~~ | — | skipped: needs AudioEngine (recipes lack engine handle) |

Rules:
- Exact-path imports (`from '../blocks/gameplay/X'`), no barrel-star.
- No new deps. No imports from other `game/*`.
- Each recipe keeps its public opts shape backward-compatible (additive fields only).
- `EndOverlay`/`HudPanel`/`Toast`/`HealthBar`/`DamageNumber`/`WorldBar`/`MinimapDots` must be null-safe without DOM (Node tests) — existing blocks already are.

Acceptance: `node scripts/unused-check.mjs` drops the wired blocks from the "possibly unused" list (ChunkWorld/MapBuilder/TerrainBuilder stay — used by demos via other paths); probe-all PASS. **Result: 19 → 5 unused** (SfxPlayer + GridAStar intentional; 3 demo-owned).

### Slice C — Hub & first-run

| Item | Contract |
|---|---|
| Hub cards | Each skeleton card shows: 骨架名 · 一句话 · 入口链接 · 用到的积木标签 |
| "从哪开始" | Keep 3-step path; link TUTORIAL + BLOCKS |
| WebGPU error page | Already exists; ensure hub links to it only via live entries (no dead anchors) |
| README table | Match hub (add missing arpg/collect/rally/dungeon rows if absent) |

Acceptance: hub.html builds; README lists all HTML entries; no broken relative links.

### Testing

- typecheck / test / build / probe-all green
- New recipe behaviors covered where cheap (AOE areaHits already tested; PlaceGrid/Spawner/LevelTable/RunState now tested)
- Browser probe asserts key HUD ids still present after EndOverlay/HudPanel swap

## [S3] Out of Scope

- npm publish
- Domain deploy
- Real music / large asset packs
- Full nightraid refactor
- New recipe genres beyond depth hooks

## Tasks

- [x] T1: Quality gate policy + defineGame validate + BaseRecipeOpts + registry error (covers: S2 A)
- [x] T2: Block unit tests PlaceGrid/Spawner/LevelTable/RunState/defineGame — acceptance: test green (covers: S2 A; depends: T1)
- [x] T3: Wire BaseRecipeOpts into recipe opts + STRUCTURE bundle budget note — acceptance: typecheck; docs updated (covers: S2 A; depends: T1)
- [x] T4: ARPG depth — DamageNumber + HealthBar + EndOverlay + WorldBar + AreaDamage skill + RunState + HudPanel — acceptance: probe arpg HUD; typecheck (covers: S2 B; depends: T1). SfxPlayer skipped (needs AudioEngine).
- [x] T5: TD depth — PlaceGrid occupy/release(sell) + BuildCatalog/BuildSystem place/upgrade/remove + HudPanel + EndOverlay + Toast — acceptance: probe tower; place/sell works (covers: S2 B; depends: T1)
- [x] T6: FPS-arena depth — Health + HealthBar + DamageNumber + EndOverlay + HudPanel; targets fight back — acceptance: probe fps-arena (covers: S2 B; depends: T1)
- [x] T7: Dungeon depth — LevelTable + MinimapDots + HudPanel + Toast + EndOverlay — acceptance: probe dungeon (covers: S2 B; depends: T1). GridAStar skipped (no wandering pathfinding enemies).
- [x] T8: Collect/Survival/Rally depth — RunState/EndOverlay/Toast/HudPanel; survival Spawner+Timers — acceptance: probe collect/survival/rally (covers: S2 B; depends: T1)
- [x] T9: Hub cards + README entry table sync — acceptance: all HTML entries listed; hub builds (covers: S2 C; depends: T3)
- [x] T10: Full verify typecheck/test/build/probe-all + unused-check delta — acceptance: all green (covers: S2; depends: T3-T9)
