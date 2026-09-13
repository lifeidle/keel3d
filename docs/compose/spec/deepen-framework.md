---
feature: deepen-framework
status: in-progress
updated: 2026-09-13
branch: feature/deepen-framework
commits: # filled at delivery
---

# Deepen Framework — performance, gameplay depth, docs

## Report

## [S1] Problem

After polish, three gaps remain before the project feels “complete” for day-to-day use:

1. **Performance / code hygiene** — `nightraid` is still a large demo; no clear “what to copy vs what to ignore”; import discipline is soft.
2. **Gameplay depth** — `BgmLayers` exists but nothing uses it; recipes are thin; tower/dungeon lack small depth hooks.
3. **Docs / teaching** — QUICKSTART is a checklist, not a guided path; API reference is incomplete for new blocks.

## [S2] Design

Three slices on one branch; npm publish remains out of scope.

### Slice A — Performance & cleanup

| Item | Contract |
|---|---|
| Import lint note | `docs/STRUCTURE.md`: exact-path rule for blocks; no barrel-star |
| `scripts/unused-check.mjs` | Report files in `src/blocks/**` never imported by `src/recipes/**` or demos (informational) |
| README architecture | One paragraph: copy recipes vs read nightraid |
| Remove dead | Unused vars in recipes if any after A/B/C |

### Slice B — Gameplay depth

| Item | Contract |
|---|---|
| Wire `BgmLayers` in ARPG | attach on first gesture; intensity from nearby-enemy ratio; optional silent if no buffers |
| Tower depth | Show tower level in HUD; pad `kitPad` visual under towers |
| Dungeon depth | Show room progress text already; add door open SFX beep |
| Collect depth | Par time display + “再来一局” key R |

### Slice C — Docs & teaching

| Item | Contract |
|---|---|
| `docs/TUTORIAL.md` | 15-minute path: template → collect → arpg; links to blocks |
| `API.md` | Add audio/ui/kit one-liners |
| QUICKSTART | Link TUTORIAL.md |
| hub | “从哪开始”三步说明 |

### Testing

- typecheck / test / build / probe-all green
- ARPG still shows quest + bar after BGM wire
- No new deps

## [S3] Out of Scope

- npm publish
- Domain deploy
- Full nightraid refactor
- Large asset packs

## Tasks

- [ ] T1: STRUCTURE import rules + unused-check script — acceptance: script runs (covers: S2 A)
- [ ] T2: README copy-vs-ignore guidance — acceptance: section exists (covers: S2 A; depends: T1)
- [ ] T3: ARPG BgmLayers intensity wire — acceptance: no crash without audio buffers (covers: S2 B; depends: T1)
- [ ] T4: Tower level HUD + kitPad; dungeon beep; collect R restart — acceptance: typecheck; probe tower/collect (covers: S2 B; depends: T1)
- [ ] T5: TUTORIAL.md + API/QUICKSTART/hub links — acceptance: docs exist and linked (covers: S2 C; depends: T1)
- [ ] T6: Full verify — acceptance: typecheck/test/build/probe green (covers: S2; depends: T2-T5)
