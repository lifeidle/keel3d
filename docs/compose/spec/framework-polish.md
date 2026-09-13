---
feature: framework-polish
status: in-progress
updated: 2026-09-13
branch: feature/framework-polish
commits: # filled at delivery
---

# Framework Polish — open-source quality, audio/UI, kit, cleanup

## Report

## [S1] Problem

KeeL 3D can already assemble games, but four gaps block a “complete, professional” feel:

1. **Engineering / OSS quality** — no bundle-size check, CI does not probe pages, docs/structure drift.
2. **Audio** — `AudioEngine` exists but there is no thin SFX/BGM block for recipes.
3. **Deep UI** — no button bar / quest-style tracker for skill or objective HUDs.
4. **Kit & cleanup** — placeholder art is thin; some dead fields and stale comments remain.

## [S2] Design

Work in **four ordered slices** on one branch. Each slice stays opt-in (no auto-registration).

### Slice A — Open-source & engineering (first)

| Item | Contract |
|---|---|
| `scripts/bundle-report.mjs` | After `npm run build`, list `dist/assets/*` sizes; exit 0 (report only) |
| `package.json` scripts | `probe:all`, `demo`, `bundle:report` documented |
| CI | Run `typecheck` + `test` + `build` + `bundle:report` (probe optional if no Chrome) |
| Docs consistency | README/STRUCTURE/QUICKSTART mention probe + bundle tools; no dead links |
| package metadata | license/homepage/repository consistent |

### Slice B — Audio blocks

`src/blocks/audio/SfxPlayer.ts` — wrap `AudioEngine` playBuffer with volume; no-ops when no context.

```ts
new SfxPlayer(audioEngine)
sfx.play(buffer, gain?)
sfx.playUrl(url) // load + cache via AssetHub
```

`src/blocks/audio/BgmLayers.ts` — two gain nodes (calm/intense), `setIntensity(0..1)`, `start/stop`.

Wire **optional** demo: ARPG fire/kill plays a short beep via WebAudio oscillator if no buffer (so demo works without new assets).

### Slice C — Deep UI

| Block | Contract |
|---|---|
| `ButtonBar` | N slots, label/key, active highlight, click/key callback |
| `QuestTracker` | list of `{id,title,done}`; DOM panel top-right |

Wire ARPG: ButtonBar 1=attack hint; QuestTracker: “击杀 10 个目标”.

### Slice D — kit + cleanup

| Item | Action |
|---|---|
| kit | Add `kitPillar`, `kitPad`; scatter more variety |
| ARPG/tower | Use kit pad under towers (optional visual only) |
| Cleanup | Remove unused vars; fix stale comments (e.g. new-game recipe list) |
| Docs | BLOCKS.md audio/ui/kit sections |

### Testing

- Unit: SfxPlayer no-context safety; ButtonBar/QuestTracker DOM stubs in Node (null-safe).
- typecheck / test / build / probe-all PASS.
- No import from other `game/*` samples.

## [S3] Out of Scope

- Full night-raid gameplay rewrite
- Real music files / large asset packs
- npm publish (user 2FA)
- Domain deploy

## Tasks

- [ ] T1: Slice A bundle-report + package scripts + CI + docs links — acceptance: script runs; CI file updated (covers: S2 A)
- [ ] T2: SfxPlayer + BgmLayers + tests — acceptance: typecheck; no-context safe (covers: S2 B; depends: T1)
- [ ] T3: ARPG optional SFX hook — acceptance: build green; no asset required (covers: S2 B; depends: T2)
- [ ] T4: ButtonBar + QuestTracker + ARPG wire — acceptance: HUD shows quest text (covers: S2 C; depends: T1)
- [ ] T5: kit extras + cleanup + BLOCKS docs — acceptance: docs list new APIs (covers: S2 D; depends: T1)
- [ ] T6: Full verify typecheck/test/build/probe — acceptance: all green (covers: S2; depends: T2-T5)
