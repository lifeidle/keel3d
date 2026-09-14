---
feature: genre-plan
status: delivered
updated: 2026-09-13
branch: feature/genre-plan
commits: 151300e..(head at delivery)
---

# Genre Plan — full coverage catalog + execution plan

## Report

**What was built** — `docs/GENRE_COVERAGE.md`: genre × status matrix (24 categories), pending extract-rest inventory, P0/P1 block contracts, ten new recipe specs, R0–R8 roadmap, commercial-license discipline, plus **§10 detailed execution plan** (per-round work packages with API contracts, file paths, tests, acceptance criteria, dependency graph, Compose checklist template, effort estimates, and full Definition of Done).

**Verification** — docs-only; no runtime change. Inventory cross-checked against master recipes/blocks and extract-rest pending tree.

**Journey log** —
1. Gap analysis beat guessing: unused-check + recipe list + extract-rest pending inventory made the matrix concrete.
2. Web search unavailable — self-implemented MIT policy instead of vendoring.
3. Detailed APIs in §10 double as future spec S2 drafts for each R-round Compose feature.

## [S1] Problem

Hub/recipes cover ~8 genres. Unclear what other 3D web game types the base can assemble, which generic blocks are missing, and how to expand without license risk — and how to actually execute the fill-in.

## [S2] Design

Single planning artifact `docs/GENRE_COVERAGE.md` (catalog §1–9 + execution plan §10–14). No code this round.

## [S3] Out of Scope

- Implementing P0/P1 blocks or new recipes (next Compose features)
- Merging extract-rest
- npm publish

## Tasks

- [x] T1: Write GENRE_COVERAGE.md catalog — acceptance: matrix + P0/P1 + recipes + roadmap + license (covers: S2)
- [x] T2: Write §10 execution plan — acceptance: R0–R8 work packages, APIs, deps, DoD (covers: S2; depends: T1)
