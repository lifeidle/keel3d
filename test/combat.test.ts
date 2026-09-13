import { test } from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../src/physics/world';

// Rapier's WASM must be initialised before any World/collider is created.
await RAPIER.init();

// Both the player and enemies fire from INSIDE their own capsule colliders.
// A ray cast without excluding the shooter would register the shooter's own
// collider first (toi 0) and never reach the target — which is exactly the
// bug where enemies were harmless. This test pins the exclusion behaviour.
test('enemy fire reaches the player, not itself (shooter-exclusion regression)', () => {
  const phys = new PhysicsWorld();

  // target "player" box 5m in front of the shooter
  const target = phys.addStaticBox({ x: 0, y: 1.55, z: 5 }, { x: 0.35, y: 0.85, z: 0.35 });

  // shooter capsule (enemy archetype): eye sits ~0.3 above the body centre,
  // i.e. inside the capsule, just like Enemy.eye() in the game.
  const body = phys.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 1.25, 0)
  );
  const shooter = phys.world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.35), body);

  // step AFTER adding colliders so they enter Rapier's query pipeline
  for (let i = 0; i < 3; i++) phys.step();

  const origin = { x: 0, y: 1.55, z: 0 };
  const dir = { x: 0, y: 0, z: 1 };

  // raw behaviour: without exclusion the ray hits the shooter's own capsule
  const selfHit = phys.raycast(origin, dir, 20);
  assert.ok(selfHit, 'a ray is cast');
  assert.equal(selfHit!.collider.handle, shooter.handle, 'without exclusion the shooter hits itself');

  // the fix: excluding the shooter lets the bullet reach the target
  const through = phys.raycast(origin, dir, 20, shooter);
  assert.ok(through, 'with exclusion the ray reaches something beyond the shooter');
  assert.notEqual(through!.collider.handle, shooter.handle, 'with exclusion we do NOT hit ourselves');
  assert.equal(through!.collider.handle, target.handle, 'with exclusion we hit the target');

  phys.world.removeCollider(target, false);
  phys.world.removeRigidBody(body);
});

test('player muzzle (outside the capsule) reaches the target without exclusion', () => {
  const phys = new PhysicsWorld();

  const target = phys.addStaticBox({ x: 0, y: 1.55, z: 5 }, { x: 0.35, y: 0.85, z: 0.35 });

  // step AFTER adding colliders so they enter Rapier's query pipeline
  for (let i = 0; i < 3; i++) phys.step();

  // muzzle sits ~0.7m in front of the eye, outside the 0.35m-radius capsule
  const muzzle = { x: 0, y: 1.55, z: 0.7 };
  const dir = { x: 0, y: 0, z: 1 };

  const hit = phys.raycast(muzzle, dir, 20);
  assert.ok(hit, 'muzzle ray is cast');
  assert.equal(hit!.collider.handle, target.handle, 'muzzle shot reaches the target');

  phys.world.removeCollider(target, false);
});
