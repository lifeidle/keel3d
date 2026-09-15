/**
 * CharacterController — shared capsule locomotion for FPS/TPS/platformer.
 * Pure movement on a Rapier kinematic body; no CONFIG, no game/ imports.
 */
import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d';
import type { PhysicsWorld } from '../../physics/world';
import { createUnitBody, type UnitBody } from '../Unit';

export interface CharCtrlOpts {
  radius?: number;
  height?: number;
  speed?: number;
  sprintMul?: number;
  jumpSpeed?: number;
  airControl?: number;
  /** Extra gravity while falling (snappier arcs). Default 0. */
  extraGravity?: number;
  tag?: string;
  spawn?: THREE.Vector3;
}

export interface CharInput {
  /** -1..1 world-relative after camera yaw transform, or raw stick. */
  moveX: number;
  moveZ: number;
  jump: boolean;
  sprint?: boolean;
}

/** Pure intent math (unit-testable without physics). */
export function computeMoveIntent(
  input: CharInput,
  cameraYaw: number,
  speed: number,
  sprintMul: number,
): { vx: number; vz: number; wantJump: boolean; sprinting: boolean } {
  const sprinting = !!input.sprint;
  const spd = speed * (sprinting ? sprintMul : 1);
  // stick/move is camera-relative: forward is -Z when yaw=0
  const s = Math.sin(cameraYaw);
  const c = Math.cos(cameraYaw);
  const wx = input.moveX * c + input.moveZ * s;
  const wz = -input.moveX * s + input.moveZ * c;
  const len = Math.hypot(wx, wz);
  const nx = len > 1e-5 ? wx / len : 0;
  const nz = len > 1e-5 ? wz / len : 0;
  const scale = Math.min(1, len) * spd;
  return { vx: nx * scale, vz: nz * scale, wantJump: input.jump, sprinting };
}

export class CharacterController {
  private unit: UnitBody;
  private radius: number;
  private height: number;
  private speed: number;
  private sprintMul: number;
  private jumpSpeed: number;
  private airControl: number;
  private extraGravity: number;
  private vy = 0;
  private _grounded = false;
  private mesh: THREE.Object3D | null = null;
  private _pos = new THREE.Vector3();
  private _vel = new THREE.Vector3();

  constructor(
    private physics: PhysicsWorld,
    opts: CharCtrlOpts = {},
  ) {
    this.radius = opts.radius ?? 0.35;
    this.height = Math.max(opts.height ?? 1.7, this.radius * 2 + 0.05);
    this.speed = opts.speed ?? 6.5;
    this.sprintMul = opts.sprintMul ?? 1.7;
    this.jumpSpeed = opts.jumpSpeed ?? 8.5;
    this.airControl = opts.airControl ?? 0.35;
    this.extraGravity = opts.extraGravity ?? 12;
    const spawn = opts.spawn ?? new THREE.Vector3(0, 0.1, 0);
    this.unit = createUnitBody(physics, {
      radius: this.radius,
      height: this.height,
      spawn,
      tag: opts.tag ?? 'player',
    });
    this._pos.copy(spawn);
  }

  get body(): RAPIER.RigidBody {
    return this.unit.body;
  }

  get collider(): RAPIER.Collider {
    return this.unit.collider;
  }

  get position(): THREE.Vector3 {
    return this._pos;
  }

  get grounded(): boolean {
    return this._grounded;
  }

  get velocity(): THREE.Vector3 {
    return this._vel;
  }

  get eyeHeight(): number {
    return this.height * 0.9;
  }

  setMesh(obj: THREE.Object3D): void {
    this.mesh = obj;
  }

  teleport(x: number, y: number, z: number): void {
    const centerY = this.height / 2;
    this.unit.body.setNextKinematicTranslation({ x, y: y + centerY, z });
    this.physics.world.step();
    this._pos.set(x, y, z);
    this.vy = 0;
    this.syncMesh();
  }

  update(dt: number, input: CharInput, cameraYaw: number): void {
    if (dt <= 0) return;
    const intent = computeMoveIntent(input, cameraYaw, this.speed, this.sprintMul);
    const ctrl = this.airControl;
    const vx = this._grounded ? intent.vx : intent.vx * ctrl + this._vel.x * (1 - ctrl);
    const vz = this._grounded ? intent.vz : intent.vz * ctrl + this._vel.z * (1 - ctrl);

    if (this._grounded && intent.wantJump) {
      this.vy = this.jumpSpeed;
      this._grounded = false;
    }
    this.vy -= this.extraGravity * dt;
    if (this.vy < -40) this.vy = -40;

    const desired = {
      x: this._pos.x + vx * dt,
      y: this._pos.y + this.vy * dt,
      z: this._pos.z + vz * dt,
    };
    const half = this.height / 2 - this.radius;
    const center = { x: desired.x, y: desired.y + half + this.radius, z: desired.z };
    this.unit.body.setNextKinematicTranslation(center);
    // caller typically steps the world once per frame; we read back after step
    this._vel.set(vx, this.vy, vz);
  }

  /** Call after physics.step() to read kinematic result. */
  syncFromPhysics(): void {
    const t = this.unit.body.translation();
    const half = this.height / 2 - this.radius;
    const feetY = t.y - (half + this.radius);
    this._grounded = false;
    if (this.vy <= 0.01) {
      // The ray origin (capsule center) is INSIDE the unit's own collider, and
      // Rapier reports a toi=0 hit for origins inside a solid — without
      // excluding it, the "grounded" check is a self-hit that is ALWAYS true
      // (even in mid-air), and any surface-snap keyed to that hit would push
      // the unit up every frame. Exclude the own collider.
      const hit = this.physics.raycast(
        { x: t.x, y: t.y, z: t.z },
        { x: 0, y: -1, z: 0 },
        half + this.radius + 0.25,
        this.unit.collider,
      );
      this._grounded = !!hit;
      if (this._grounded && this.vy < 0) this.vy = 0;
      if (hit && feetY < hit.point.y - 1e-4) {
        // Kinematic bodies are placed, never resolved: the solver does not
        // extrude the capsule out of the floor. Per-frame gravity therefore
        // ratchets the feet ~extraGravity*dt*dt below the surface every frame
        // (the grounded check resets vy but not position) → silent 0.2/s sink
        // through visible terrain. Snap the feet bookkeeping onto the surface
        // on penetration; the next update() re-places the body there.
        this._pos.set(t.x, hit.point.y, t.z);
        this.syncMesh();
        return;
      }
    }
    this._pos.set(t.x, feetY, t.z);
    this.syncMesh();
  }

  private syncMesh(): void {
    if (!this.mesh) return;
    this.mesh.position.set(this._pos.x, this._pos.y + this.height / 2, this._pos.z);
  }

  dispose(): void {
    try {
      this.physics.world.removeRigidBody(this.unit.body);
    } catch {
      /* already gone */
    }
  }
}
