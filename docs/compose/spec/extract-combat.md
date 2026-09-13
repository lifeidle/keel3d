---
feature: extract-combat
status: designed
updated: 2026-09-13
branch: feature/extract-combat
commits: # filled at delivery
---

# Extract Combat — Magazine + Arsenal to L2 blocks

## Report

## [S1] Problem

Reusable combat bookkeeping lives inside the Night Raid sample:

- `src/game/nightraid/weapons/magazine.ts` is pure logic (no engine deps) and already unit-tested, but the test imports from `game/nightraid` — violating the independence rule that tests/recipes should use framework blocks.
- `src/game/nightraid/weapons/weapon.ts` mixes generic slot/mag/cooldown/reload/recoil state with content-specific hitscan, effects, and audio. New games that want multi-weapon ammo must copy-paste from the sample.
- `fps-arena` (the light FPS skeleton) has fire cooldown only — no magazine, no reload, no reserve — so it does not demonstrate the combat depth the framework already has.

## [S2] Design

First extraction slice: **pure combat state machines only**. No hitscan, no three.js, no audio, no physics.

### New blocks

#### `src/blocks/combat/Magazine.ts`

Move `Magazine` class verbatim from nightraid (already side-effect free). Public API unchanged:

```ts
new Magazine(magSize, rounds, reserve)
canFire() consume() startReload(t) cancelReload() tick(dt) refillReserve(initial)
get empty · rounds · reserve · reloading · magSize
```

#### `src/blocks/combat/Arsenal.ts`

Generic multi-slot weapon bookkeeping extracted from `weapon.ts` (state only):

```ts
export interface ArsenalSlotDef {
  key: string;
  magSize: number;
  reserve: number;
  reloadTime: number;
  /** shots per second */
  fireRate: number;
  auto: boolean;
}

export type FireOutcome = 'fired' | 'empty' | 'reloading' | 'cooldown' | 'idle';

export class Arsenal {
  constructor(slots: ArsenalSlotDef[], opts?: { swapCooldown?: number });
  get index(): number;
  get def(): ArsenalSlotDef;
  get mag(): number;
  get reserve(): number;
  get reloading(): boolean;
  get cooldownRemaining(): number;
  get recoil(): number;
  /** Advance timers. Returns 'fired' when a round should be consumed this frame
   *  (caller then applies damage/effects). Auto-reloads on empty when reserve > 0. */
  update(dt: number, held: boolean, clicked: boolean): FireOutcome;
  reload(): boolean;
  switchTo(index: number): boolean;
  reset(): void;
  refillAll(): void;
  /** Add cosmetic recoil kick; decayRecoil reduces it over time. */
  addRecoil(n: number): void;
  decayRecoil(dt: number, rate?: number): number;
}
```

Contracts:
- `update` does **not** call `consume` itself when returning `'fired'` — the caller decides after applying hit logic, via `consumeShot()` — wait, simpler: `update` **does** consume on `'fired'` so ammo always ticks; content layer only reacts to the outcome. **Decision: update consumes on 'fired'.**
- Empty + reserve > 0 → auto-starts reload, returns `'empty'` (caller may click).
- `switchTo` cancels current reload and sets swap cooldown (default 0.25s).
- No DOM, no three, no AudioContext.

Export both from `src/blocks/combat/index.ts` (exact-path still preferred at call sites).

### nightraid migration

| File | Change |
|---|---|
| `weapons/magazine.ts` | **Delete** (moved to blocks) |
| `weapons/weapon.ts` | Import `Magazine`/`Arsenal` from `../../blocks/combat/...`; replace hand-rolled `mags[]`/`cooldown`/`cur` with an `Arsenal` instance; keep hitscan/effects/audio in this file |
| `test/magazine.test.ts` | Import path → `../src/blocks/combat/Magazine` |

Weapon keeps: raycast, ally skip, soldier/barrel/crate/tank damage, effects, audio callbacks. It delegates slot/mag/cd/recoil to Arsenal.

### fps-arena wire-up

Replace single `Cooldown` with one-slot `Arsenal`:

```ts
const arsenal = new Arsenal([{
  key: 'carbine', magSize: 24, reserve: 72,
  reloadTime: 1.4, fireRate: 6, auto: false,
}]);
```

- Space/J held or clicked → `arsenal.update(ft, held, clicked)`; on `'fired'` run existing hitscan.
- Key R → `arsenal.reload()`.
- HUD line shows `弹药 mag/reserve` and `换弹中`.
- Opts stay backward-compatible; add optional `magSize?`, `reserve?`, `reloadTime?`.

### Testing

- `test/magazine.test.ts` — same 5 cases, new import path.
- New `test/arsenal.test.ts` — slot switch cancels reload; fire consumes + cooldown; auto vs semi trigger; empty auto-reload; reset/refillAll; recoil decay.
- scripts/test.mjs adds `'arsenal'`.

### Docs

- BLOCKS.md combat section: add Magazine + Arsenal one-liners.
- API.md: two entries.

## [S3] Out of Scope

- Extracting hitscan/weapon.ts fully (needs PhysicsWorld + Player + Effects + Audio).
- Audio path / headless:false / GameCreateContext.services.
- World props / weather / vehicles extraction.
- i18n title bug, demo-tower fork, CI probe (separate P0 round).
- noUnusedLocals sweep.

## Tasks

- [ ] T1: Add `blocks/combat/Magazine.ts` + `Arsenal.ts` + export from combat/index — acceptance: typecheck (covers: S2)
- [ ] T2: Migrate tests — magazine.test.ts new path + arsenal.test.ts + test.mjs list — acceptance: test green (covers: S2; depends: T1)
- [ ] T3: nightraid weapon.ts uses Arsenal; delete weapons/magazine.ts — acceptance: typecheck; magazine test still green (covers: S2; depends: T1)
- [ ] T4: fps-arena Arsenal + R reload + HUD ammo — acceptance: typecheck; probe fps-arena (covers: S2; depends: T1)
- [ ] T5: BLOCKS.md + API.md entries — acceptance: docs list new APIs (covers: S2; depends: T1)
- [ ] T6: Full verify typecheck/test/build/probe — acceptance: all green (covers: S2; depends: T2-T5)
