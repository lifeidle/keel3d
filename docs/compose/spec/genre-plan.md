---
feature: genre-plan
status: delivered
updated: 2026-09-13
branch: feature/genre-plan
commits: 151300e..(head at delivery)
---

# Genre Plan — full coverage catalog

## Report

**What was built** — `docs/GENRE_COVERAGE.md`: genre × status matrix (24 categories), pending extract-rest inventory, P0/P1 block contracts (CharacterController, Gamepad, Inventory+UI, LootTable, Faction, shoulder cam, Dialogue, XP, ProcDungeon, Craft, VisionCone…), ten new recipe specs, phased roadmap R0–R8, and commercial-license discipline (self-MIT; no GPL/SSPL; CC0/MIT/Apache assets only).

**Verification** — docs-only; no runtime change. Links to existing recipes/blocks verified against repo inventory.

**Journey log** —
1. Gap analysis beat guessing: unused-check + recipe list + extract-rest pending inventory made the matrix concrete.
2. Web search unavailable in env — plan uses self-implemented MIT policy instead of vendoring.
3. extract-rest merge is zero-cost P0 before new genres.

## [S1] Problem

Hub/recipes cover ~8 genres. It is unclear which other 3D web game types the base can actually assemble, what generic blocks are missing, and how to expand without license risk.

## [S2] Design

Single planning artifact `docs/GENRE_COVERAGE.md` (see file). No code this round.

## [S3] Out of Scope

- Implementing P0/P1 blocks or new recipes (next Compose features)
- Merging extract-rest
- npm publish

## Tasks

- [x] T1: Write GENRE_COVERAGE.md — acceptance: matrix + P0/P1 + recipes + roadmap + license policy (covers: S2)
