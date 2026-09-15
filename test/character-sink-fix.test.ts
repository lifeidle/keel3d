import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * CharacterController grounded-check regression lock (source-level).
 *
 * Two latent defects in the grounded raycast, both caught by the yexi rebuild
 * (slice 2: a walkable night scene):
 *
 * 1. SELF-HIT: the ray origin is the capsule center — inside the unit's own
 *    collider. Rapier reports a toi=0 hit for ray origins inside a solid
 *    collider, so the grounded check is ALWAYS true (even in mid-air): the
 *    "grounded" state was a self-hit false positive, jumps worked in mid-air,
 *    and air control was ground control. Fix: pass the own collider as
 *    `excludeCollider`.
 *
 * 2. SINK RATCHET: the unit body is kinematic (placed via
 *    setNextKinematicTranslation, never resolved by the solver). Per-frame
 *    gravity ratchets the feet below the floor surface (the grounded check
 *    resets vy but not position) → a standing character silently sinks 0.2/s
 *    through visible terrain. Fix: when the feet are below the (real) hit
 *    surface, snap the feet bookkeeping onto the surface; the next update()
 *    re-places the body there.
 *
 * Without both, the snap (2) keyed to a self-hit (1) pushes the unit UP every
 * frame (~0.85/frame) — the observed 63 m/s ascent.
 *
 * Source-level on purpose: CharacterController needs a live PhysicsWorld
 * (Rapier WASM) to instantiate, which crashes in bare Node — same constraint
 * that makes the WASM recipes audit at source level.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
// bundled test lives in .tmp/test/ -> two levels up is the repo root
const root = path.resolve(here, '..', '..');
const src = fs.readFileSync(
  path.join(root, 'src', 'blocks', 'player', 'CharacterController.ts'),
  'utf8',
);

test('grounded raycast excludes the unit own collider (no toi=0 self-hit)', () => {
  assert.ok(
    src.includes('this.physics.raycast'),
    'grounded raycast removed',
  );
  // the ray call must pass the own collider as excludeCollider (4th arg)
  const rayCall = src.slice(
    src.indexOf('this.physics.raycast'),
    src.indexOf('this.physics.raycast') + 400,
  );
  assert.ok(
    rayCall.includes('this.unit.collider'),
    'own collider not excluded — grounded check hits the own capsule (toi=0, always true)',
  );
  assert.ok(
    src.includes('this._grounded = !!isPlatform'),
    'grounded flag wiring removed (must derive from the platform-filtered hit)',
  );
});

test('non-platform colliders (other characters) are skipped by the grounded check', () => {
  // characters must not stand on other characters: the API + the filter must
  // both exist, or the character rides on moving bodies (yexi slice 3
  // regression: the grounded ray hit an enemy capsule and the surface snap
  // lifted the player onto the enemy, camY 3.2).
  assert.ok(
    src.includes('setNonPlatformColliders'),
    'setNonPlatformColliders API missing',
  );
  assert.ok(
    src.includes('this._nonPlatform?.has(hit.collider)'),
    'non-platform filter missing from the grounded raycast',
  );
});

test('penetrating feet are snapped onto the floor surface (no 0.2/s sink)', () => {
  // penetration guard + snap onto the hit surface
  assert.ok(
    src.includes('feetY < hit.point.y'),
    'missing penetration guard (feetY < hit.point.y) — sink ratchet regression',
  );
  assert.ok(
    src.includes('this._pos.set(t.x, hit.point.y, t.z)'),
    'missing surface snap (_pos.set(t.x, hit.point.y, t.z))',
  );
  // the non-penetrating path must keep reading the body translation
  assert.ok(
    src.includes('this._pos.set(t.x, feetY, t.z)'),
    'missing the normal (non-penetrating) position read-back',
  );
});
