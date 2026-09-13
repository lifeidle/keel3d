/**
 * Unit body factory — kinematic capsule shared by FPS / third-person avatars.
 * Stats come from the caller (PlayerSpec / UnitDef); no CONFIG import.
 */
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import type { PhysicsWorld } from '../physics/world';

export interface UnitBodyOpts {
  radius: number;
  height: number;
  /** Spawn at feet position. */
  spawn: THREE.Vector3;
  /** userData tag on the rigid body (e.g. 'player' | 'enemy'). */
  tag?: string;
}

export interface UnitBody {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  /** Capsule center (not feet). */
  center: THREE.Vector3;
}

export function createUnitBody(physics: PhysicsWorld, opts: UnitBodyOpts): UnitBody {
  const r = opts.radius;
  const half = opts.height / 2 - r;
  const centerY = half + r;
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      opts.spawn.x,
      opts.spawn.y + centerY,
      opts.spawn.z,
    ),
  );
  const collider = physics.world.createCollider(
    RAPIER.ColliderDesc.capsule(half, r).setFriction(0.0),
    body,
  );
  const controller = physics.createCharacterController(0.02);
  body.userData = { type: opts.tag ?? 'unit' };
  const center = new THREE.Vector3(opts.spawn.x, opts.spawn.y + centerY, opts.spawn.z);
  return { body, collider, controller, center };
}
