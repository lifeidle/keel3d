// First-person player: Rapier kinematic character controller + camera rig.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { CONFIG } from '../../../config';
import { PhysicsWorld } from '../../../physics/world';
import { Input } from '../../../engine/input';

export class Player {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  pos = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  vy = 0;
  grounded = false;
  health: number = CONFIG.player.maxHealth;
  alive = true;
  sensMul = 1; // sensitivity multiplier from the settings slider
  private jumpQueued = false;
  private stepTimer = 0;
  onFootstep: (() => void) | null = null;

  constructor(private physics: PhysicsWorld, spawn: THREE.Vector3) {
    const r = CONFIG.player.radius;
    const half = CONFIG.player.height / 2 - r; // capsule half-height
    const center = half + r; // distance from feet to capsule center

    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + center, spawn.z)
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(half, r).setFriction(0.0),
      this.body
    );
    this.controller = physics.createCharacterController(0.02);
    this.body.userData = { type: 'player' };
    this.pos.set(spawn.x, spawn.y + center, spawn.z);
  }

  queueJump() {
    this.jumpQueued = true;
  }

  getEye(out = new THREE.Vector3()): THREE.Vector3 {
    // eye height is measured from the feet; capsule center is at pos.y
    const eyeFromCenter = CONFIG.player.eyeHeight * (this.curHeight / CONFIG.player.height) - CONFIG.player.height / 2 + CONFIG.player.height / 2 - this.curHeight / 2;
    return out.set(this.pos.x, this.pos.y + eyeFromCenter, this.pos.z);
  }

  forwardDir(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  /**
   * Stance state machine. Ctrl HELD = crouch (stand or up from prone); Z tap =
   * prone toggle. Standing back up restores the full capsule; the character
   * controller absorbs any push-out on open ground.
   */
  updateStance(crouchHeld: boolean, proneToggle: boolean) {
    const want: typeof this.pose = crouchHeld
      ? 'crouch'
      : proneToggle
        ? (this.pose === 'prone' ? 'stand' : 'prone')
        : this.pose === 'crouch' && !crouchHeld
          ? 'stand'
          : this.pose;
    if (want !== this.pose) this.applyPose(want);
  }

  private applyPose(pose: 'stand' | 'crouch' | 'prone') {
    const oldHeight = this.curHeight;
    this.pose = pose;
    this.curHeight = CONFIG.player.height * Player.POSE_MUL[pose];
    const newHalf = this.curHeight / 2 - CONFIG.player.radius;
    const feetY = this.pos.y - (oldHeight / 2 - CONFIG.player.radius) - CONFIG.player.radius;
    const newCenter = this.curHeight / 2 - CONFIG.player.radius + CONFIG.player.radius;
    this.collider.setHalfHeight(newHalf);
    this.pos.y = feetY + newCenter;
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
  }

  /** ADS dampens mouse rotation (set by the game each frame). */
  adsMul = 1;

  // --- stance (CS/PUBG-style: hold Ctrl to crouch, tap Z to go prone) ---
  pose: 'stand' | 'crouch' | 'prone' = 'stand';
  private curHeight: number = CONFIG.player.height;

  private static POSE_MUL: Record<'stand' | 'crouch' | 'prone', number> = {
    stand: 1,
    crouch: 0.62,
    prone: 0.34,
  };
  private static SPEED_MUL: Record<'stand' | 'crouch' | 'prone', number> = {
    stand: 1,
    crouch: 0.55,
    prone: 0.3,
  };

  applyLook(dx: number, dy: number) {
    const s = CONFIG.player.mouseSensitivity * this.sensMul * this.adsMul;
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    const lim = Math.PI / 2 - 0.02;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;
  }

  /** PvP respawn: full health, back on the ground at the given spot. */
  respawnAt(x: number, z: number) {
    this.health = CONFIG.player.maxHealth;
    const gy = this.terrainHeightAt?.(x, z) ?? this.pos.y;
    this.pos.set(x, gy + CONFIG.player.height / 2, z);
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    this.vy = 0;
  }

  /** Terrain probe injected by the game (avoids a circular import). */
  terrainHeightAt: ((x: number, z: number) => number) | null = null;

  /** Medkit pickup: heal up to the cap. Returns the amount actually healed. */
  heal(a: number): number {
    const before = this.health;
    this.health = Math.min(CONFIG.player.maxHealth, this.health + a);
    return this.health - before;
  }

  /** Full reset for a new operation (fresh map): health, position, motion. */
  reset(spawn: THREE.Vector3) {
    this.health = CONFIG.player.maxHealth;
    this.alive = true;
    this.vy = 0;
    this.jumpQueued = false;
    this.stepTimer = 0;
    const c = CONFIG.player.height / 2;
    this.pos.set(spawn.x, spawn.y + c, spawn.z);
    this.body.setTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, true);
  }

  /** Apply damage. Returns true if this hit was fatal. */
  damage(d: number): boolean {
    if (!this.alive) return false;
    this.health -= d;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt: number, input: Input, camera: THREE.PerspectiveCamera) {
    if (!this.alive) {
      // keep eye/camera at last spot, no movement
      camera.position.copy(this.getEye());
      camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      return;
    }

    // --- stance (Ctrl hold / Z toggle) ---
    this.updateStance(input.crouchHeld, input.consumeProneToggle());

    // --- look ---
    const m = input.consumeMouse();
    this.applyLook(m.x, m.y);

    // --- jump / gravity ---
    if (this.jumpQueued && this.grounded && this.pose === 'stand') this.vy = CONFIG.player.jumpSpeed;
    this.jumpQueued = false;
    this.vy += CONFIG.world.gravity * dt;

    // --- horizontal move in yaw space ---
    const ax = input.moveAxis();
    const fwd = this.forwardDir();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const move = new THREE.Vector3()
      .addScaledVector(fwd, ax.z)
      .addScaledVector(right, ax.x);
    if (move.lengthSq() > 1e-6) move.normalize();
    const speed =
      CONFIG.player.moveSpeed *
      (ax.sprint && this.pose === 'stand' ? CONFIG.player.sprintMul : 1) *
      Player.SPEED_MUL[this.pose];
    move.multiplyScalar(speed * dt);

    const desired = { x: move.x, y: this.vy * dt, z: move.z };
    this.controller.computeColliderMovement(this.collider, desired);
    const corrected = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = 0;

    this.pos.x += corrected.x;
    this.pos.y += corrected.y;
    this.pos.z += corrected.z;
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });

    // footsteps
    if (this.alive && this.grounded && move.lengthSq() > 1e-6) {
      this.stepTimer += dt;
      const interval = ax.sprint ? 0.28 : 0.42;
      if (this.stepTimer >= interval) {
        this.stepTimer = 0;
        this.onFootstep?.();
      }
    } else {
      this.stepTimer = 0.18;
    }

    // --- camera ---
    camera.position.copy(this.getEye());
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
