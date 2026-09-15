import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Recipe shell audit (source-level) — every recipe must carry the unified
 * experience shell:
 *   - `new PauseMenu` + `pause.system`        (PauseMenu instance + frame hook)
 *   - `new ControlsOverlay` + `controls.system` (controls overlay + frame hook)
 *   - a `status` field on stats()             (uniform contract; endless /
 *                                             sandbox recipes use constant 'playing')
 *
 * Source-level (not runtime-instantiate) on purpose: four recipes (tps,
 * platformer, stealth, br-lite) construct a PhysicsWorld (Rapier WASM) at
 * create-time, so they cannot be instantiated in bare Node. The wiring tokens
 * above are the contract; the runtime behaviour of the shell is covered by
 * controls-shell.test.ts and the per-recipe behaviour tests.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
// bundled test lives in .tmp/test/ -> two levels up is the repo root
const root = path.resolve(here, '..', '..');
const recipeDir = path.join(root, 'src', 'recipes');

test('all 23 recipes carry the unified shell (PauseMenu + ControlsOverlay + status)', () => {
  const files = fs
    .readdirSync(recipeDir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  assert.equal(files.length, 23, `expected 23 recipe files, found ${files.length}`);

  for (const f of files) {
    const src = fs.readFileSync(path.join(recipeDir, f), 'utf8');
    assert.ok(src.includes('new PauseMenu'), `${f}: missing PauseMenu`);
    assert.ok(src.includes('new ControlsOverlay'), `${f}: missing ControlsOverlay`);
    assert.ok(src.includes('pause.system'), `${f}: missing pause.system registration`);
    assert.ok(src.includes('controls.system'), `${f}: missing controls.system registration`);
    assert.ok(src.includes('status'), `${f}: missing status on stats`);
  }
});
