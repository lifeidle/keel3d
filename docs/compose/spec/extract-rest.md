---
feature: extract-rest
status: delivered
updated: 2026-09-13
branch: feature/extract-rest
commits: 151300ef291c495a1c2ceef31eefec3d660a8150..12970f4
---

# Extract Rest — remaining reusable nightraid modules to L2

## Report

**What was built** — Moved the remaining reusable Night Raid modules into de-branded L2 blocks: `blocks/fx` (ShellCasings, SmokeColumns, FireSites, CombatVfx), `blocks/props` (Searchlight, ClothFlags, DestructibleCover, ExplosiveBarrel, VehicleHulk), `blocks/scene` (TimeOfDay, Weather, Vegetation), `blocks/assets/PhotoTex`, `blocks/audio/SampleBank` + `ScoreDirector`, `blocks/vehicles/WheeledVehicle` + `TrackedVehicle`, `blocks/ui/TacticalMap`. Audio/vehicle/enemy coupling uses injected callbacks and structural interfaces (`Blastable`, `MapgenSfx`, `VehicleAudio`). nightraid keeps campaign content plus thin `Audio`/`MusicDirector` wrappers that own BANK tables. `mapgen` no longer imports the sample Audio class.

**Verification** — typecheck PASS · test PASS (62) · build PASS · probe-all PASS (13 entries) · blocks/ has zero `game/` imports.

**Journey log** —
1. Parallel subagents on disjoint file sets work; shared `game.ts`/`mapgen.ts` need careful string-replace ownership.
2. Copying files on Windows can corrupt UTF-8 multi-byte sequences — rebuild as UTF-8 if vite reports UNLOADABLE_DEPENDENCY.
3. Spec over-claimed “blocks never import CONFIG”; delivered reality follows the pre-existing `src/config.ts` pattern (amended in S2).
4. Sample wrappers preserving class names/paths avoid rewriting ~15 import sites.
5. userData type strings (`'tracked'`/`'wheeled'`) must stay consistent across vehicle, weapon, and enemy.

## [S1] Problem

After Magazine/Arsenal, ~3.5k lines of generic world/fx/audio/vehicle/UI logic still live only inside `src/game/nightraid/`. New games cannot reuse shell casings, smoke, searchlights, weather, explosive barrels, combat VFX, SFX banks, driveable vehicles, or the tactical map without copying the sample. `unused:check` still lists demo-only blocks; the sample is the only consumer of this logic.

## [S2] Design

Extract **EXTRACT** and **WRAP** modules into de-branded `src/blocks/*`. STAY modules (game.ts, enemy AI, player, mission, hamlet, gunmodels, SoldierFactory, systems/*) remain content. nightraid becomes a thin consumer. No `blocks/` import from `game/`.

### Naming (脱敏)

| Sample | Block |
|---|---|
| casings | `blocks/fx/ShellCasings.ts` |
| plumes | `blocks/fx/SmokeColumns.ts` |
| searchlight | `blocks/props/Searchlight.ts` |
| phototex | `blocks/assets/PhotoTex.ts` |
| fires | `blocks/fx/FireSites.ts` |
| daynight | `blocks/scene/TimeOfDay.ts` |
| vegetation | `blocks/scene/Vegetation.ts` |
| weather | `blocks/scene/Weather.ts` |
| banners | `blocks/props/ClothFlags.ts` |
| destructibles | `blocks/props/DestructibleCover.ts` |
| barrels | `blocks/props/ExplosiveBarrel.ts` |
| effects | `blocks/fx/CombatVfx.ts` |
| audio (generic bus) | extend `blocks/audio/SfxBank.ts` |
| music mood | reuse/extend `BgmLayers` + `blocks/audio/ScoreDirector.ts` |
| vehicle hulks | `blocks/props/VehicleHulk.ts` |
| jeep/tank drive | `blocks/vehicles/WheeledVehicle.ts` + `blocks/vehicles/TrackedVehicle.ts` |
| mapui compass/minimap core | `blocks/ui/TacticalMap.ts` |

### Dependency injection (WRAP rule)

Blocks take callbacks/options — they never import Player/Enemy/Audio from `game/`:

```ts
// ExplosiveBarrel
new ExplosiveBarrel(opts: {
  x,y,z; hp; blastRadius; blastDamage;
  onExplode?: (pos, radius, damage) => void;
  mesh?: THREE.Object3D; // optional custom art
})
```

Sample adapters in nightraid wire `onExplode` to Effects/Audio/Enemy damage.

**Amendment (delivered)** — several blocks still import root `src/config.ts` for default tunables (FireSites, ClothFlags, DestructibleCover, ExplosiveBarrel, Weather, TacticalMap, WheeledVehicle, TrackedVehicle). That matches the pre-existing framework pattern (`config.ts` is not under `game/`). Full opts-injection of every CONFIG field is deferred; vehicles still read `CONFIG.tank`/`CONFIG.jeep` tables. `mapgen` still imports `placeHamlet` (STAY content module).

### Slices (implementation order)

| Slice | Modules | Risk |
|---|---|---|
| A | ShellCasings, SmokeColumns, Searchlight | low — three-only |
| B | PhotoTex, FireSites, TimeOfDay, Vegetation | low-med |
| C | Weather, ClothFlags | med — palette inject |
| D | DestructibleCover, ExplosiveBarrel | med — hit callbacks |
| E | CombatVfx | med — color inject |
| F | SfxBank, ScoreDirector | med — AudioEngine |
| G | VehicleHulk, WheeledVehicle, TrackedVehicle | high — physics |
| H | TacticalMap | med — DOM/canvas |
| I | Docs + unused-check + nightraid import cleanup | — |

Each slice: move/de-brand → nightraid adapter imports blocks → typecheck → tests if pure → continue.

### Contracts (selected)

**ShellCasings** — `spawn(pos, dir, count?)` + `update(dt)` + `dispose()`; pooled meshes; optional physics world hook.

**TimeOfDay** — `apply(t01)` sets sun/hemi/fog colors from injectable palettes; `persist` key optional.

**Weather** — `setKind(clear|fog|rain)`; `update(dt, camera)`; seeded density; rain particle budget via opts.

**ExplosiveBarrel** — HP + `hit(d)`; explode → callback; sample wires blast to enemies/player.

**SfxBank** — `constructor(engine: AudioEngine, bank: Record<string,string>)` + `play(key)`; silent without context.

**CombatVfx** — `muzzle/tracer/spark/dust/decal/boom` with injectable colors/sizes; pooled.

**WheeledVehicle / TrackedVehicle** — params (mass, speed, turn) + `update(input, dt)`; mesh attach point; sample keeps GLTF load.

**TacticalMap** — canvas dots + optional compass strip; `setContacts(list)`; worldHalf opts.

### Testing

- Pure blocks (casings math, time-of-day palette pick, barrel HP/blast radius query, sfxbank no-context) get unit tests.
- nightraid fps.html must still boot: typecheck + build + probe-all.
- No new npm deps.

### Docs

BLOCKS.md + API.md rows for every new block; STRUCTURE tree update if new folders (`fx/`, `props/`, `vehicles/`, `assets/`).

## [S3] Out of Scope

- Extracting enemy AI, player controller, mission, hamlet, gunmodels, SoldierFactory
- Rewriting game.ts God-class
- npm publish / domain deploy
- i18n title bug / demo-tower fork (separate P0)
- Real music files

## Tasks

- [x] T1: Slice A ShellCasings + SmokeColumns + Searchlight + nightraid adapters — acceptance: typecheck (covers: S2)
- [x] T2: Slice B PhotoTex + FireSites + TimeOfDay + Vegetation — acceptance: typecheck (covers: S2; depends: T1)
- [x] T3: Slice C Weather + ClothFlags — acceptance: typecheck (covers: S2; depends: T2)
- [x] T4: Slice D DestructibleCover + ExplosiveBarrel + tests — acceptance: test green (covers: S2; depends: T1)
- [x] T5: Slice E CombatVfx — acceptance: typecheck; fps probe (covers: S2; depends: T4)
- [x] T6: Slice F SampleBank + ScoreDirector — acceptance: typecheck; no-context safe test (covers: S2; depends: T1)
- [x] T7: Slice G vehicles (hulk/wheeled/tracked) — acceptance: typecheck (covers: S2; depends: T5)
- [x] T8: Slice H TacticalMap — acceptance: typecheck; fps probe map HUD (covers: S2; depends: T1)
- [x] T9: Docs BLOCKS/API/STRUCTURE — acceptance: docs list new blocks (covers: S2; depends: T1-T8)
- [x] T10: Full verify typecheck/test/build/probe-all — acceptance: all green (covers: S2; depends: T1-T9)
