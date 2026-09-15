# Catalog — 品类与配方总表（自动生成）

> 本文件由 `node scripts/catalog-gen.mjs` 从 `src/catalog/catalog.json` 生成，**请勿手改**。
> 校验：`node scripts/catalog-check.mjs`（CI 强制零漂移）。updated: 2026-09-15

## 品类（24）

| id | 页面 | 标题 | 状态 | 配方 | 探针 |
|---|---|---|---|---|---|
| `nightraid` | [`fps.html`](../fps.html) | 🎖️ FPS 完整战役 · Night Raid | playable | — | `#boot` |
| `fps` | [`fps-arena.html`](../fps-arena.html) | 🎯 FPS 骨架 | playable | `fps-arena` | `#fps-arena-hud` |
| `td` | [`tower.html`](../tower.html) | 🏰 塔防骨架 | playable | `td` | `#td-hud` |
| `open` | [`openworld.html`](../openworld.html) | 🌄 开放世界骨架 | skeleton | — | `#cultivation-hud` |
| `arpg` | [`arpg.html`](../arpg.html) | ⚔️ 俯视 ARPG 骨架 | playable | `arpg` | `#arpg-hud` |
| `collect` | [`collect.html`](../collect.html) | ✨ 收集骨架 | playable | `collect` | `#collect-hud` |
| `rally` | [`rally.html`](../rally.html) | 🏁 拉力赛骨架 | playable | `rally` | `#rally-hud` |
| `dungeon` | [`dungeon.html`](../dungeon.html) | 🗝️ 地牢骨架 | playable | `dungeon` | `#dungeon-hud` |
| `flight` | [`flight.html`](../flight.html) | ✈️ 飞行骨架 | skeleton | — | `#flight-hud` |
| `flight-arena` | [`flight-arena.html`](../flight-arena.html) | 🛩️ 空战骨架 | skeleton | `flight-arena` | `#boot` |
| `race` | [`race.html`](../race.html) | 🏎️ 赛车骨架 | skeleton | — | `#race-hud` |
| `tps` | [`tps.html`](../tps.html) | 🧍 第三人称 TPS | playable | `tps` | `#tps-hud` |
| `rogue` | [`roguelike.html`](../roguelike.html) | 🗡️ Roguelike · 旗舰可通关 | playable | `roguelike` | `#rogue-hud` |
| `plat` | [`platformer.html`](../platformer.html) | 🪜 平台跳跃 | playable | `platformer` | `#plat-hud` |
| `tycoon` | [`tycoon.html`](../tycoon.html) | 🏗️ 城建经营 | playable | `tycoon` | `#tycoon-hud` |
| `rts` | [`rts.html`](../rts.html) | 🗺️ RTS-lite | playable | `rts-lite` | `#rts-hud` |
| `stealth` | [`stealth.html`](../stealth.html) | 🥷 潜行 | playable | `stealth` | `#stealth-hud` |
| `arena` | [`arena.html`](../arena.html) | 💥 载具对战 | playable | `combat-arena` | `#arena-hud` |
| `rhythm` | [`rhythm.html`](../rhythm.html) | 🎵 音游 | playable | `rhythm` | `#rhythm-hud` |
| `sandbox` | [`sandbox.html`](../sandbox.html) | 🧊 体素沙盒 | playable | `sandbox` | `#sandbox-hud` |
| `br` | [`br.html`](../br.html) | ☠️ BR-lite | playable | `br-lite` | `#br-hud` |
| `puzzle` | [`puzzle.html`](../puzzle.html) | 🧩 物理益智 | playable | `puzzle` | `#puzzle-hud` |
| `sports` | [`sports.html`](../sports.html) | ⚽ 体育 lite | playable | `sports` | `#sports-hud` |
| `blank` | [`template.html`](../template.html) | 📦 空白模板 | template | — | `#boot` |

## 配方（20）

| --recipe | 导出 | 文件 | 页面 |
|---|---|---|---|
| `td` | `towerDefenseRecipe` | `src/recipes/tower-defense.ts` | `tower.html` |
| `survival` | `survivalRecipe` | `src/recipes/survival.ts` | — |
| `arpg` | `arpgRecipe` | `src/recipes/arpg.ts` | `arpg.html` |
| `collect` | `collectRecipe` | `src/recipes/collect.ts` | `collect.html` |
| `rally` | `rallyRecipe` | `src/recipes/rally.ts` | `rally.html` |
| `dungeon` | `dungeonRecipe` | `src/recipes/dungeon.ts` | `dungeon.html` |
| `fps-arena` | `fpsArenaRecipe` | `src/recipes/fps-arena.ts` | `fps-arena.html` |
| `tps` | `tpsRecipe` | `src/recipes/tps.ts` | `tps.html` |
| `flight-arena` | `flightArenaRecipe` | `src/recipes/flight-arena.ts` | `flight-arena.html` |
| `roguelike` | `roguelikeRecipe` | `src/recipes/roguelike.ts` | `roguelike.html` |
| `platformer` | `platformerRecipe` | `src/recipes/platformer.ts` | `platformer.html` |
| `tycoon` | `tycoonRecipe` | `src/recipes/tycoon.ts` | `tycoon.html` |
| `rts-lite` | `rtsLiteRecipe` | `src/recipes/rts-lite.ts` | `rts.html` |
| `stealth` | `stealthRecipe` | `src/recipes/stealth.ts` | `stealth.html` |
| `combat-arena` | `combatArenaRecipe` | `src/recipes/combat-arena.ts` | `arena.html` |
| `rhythm` | `rhythmRecipe` | `src/recipes/rhythm.ts` | `rhythm.html` |
| `sandbox` | `sandboxRecipe` | `src/recipes/sandbox.ts` | `sandbox.html` |
| `br-lite` | `brLiteRecipe` | `src/recipes/br-lite.ts` | `br.html` |
| `puzzle` | `puzzleRecipe` | `src/recipes/puzzle.ts` | `puzzle.html` |
| `sports` | `sportsRecipe` | `src/recipes/sports.ts` | `sports.html` |

## 新增一个品类的正确姿势

1. 在 `src/catalog/catalog.json` 的 `genres` 里加一条（新配方还要加进 `recipes`）；
2. `node scripts/catalog-gen.mjs`（自动写 hub / probe / vite / registry / 本文档）；
3. `node scripts/catalog-check.mjs` 确认零漂移；
4. `npm run typecheck && npm test && npm run build && node scripts/probe-all.mjs`。

