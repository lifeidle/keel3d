/**
 * Camera rig: fps / chase / orbit / free with runtime setMode + short lerp.
 * Sample A uses fps (+ tank chase); Sample C switches 1/2/3 at runtime.
 * update() is zero-allocation after construction (scratch vectors).
 */
import * as THREE from 'three';

export type CameraMode = 'fps' | 'chase' | 'orbit' | 'free' | 'shoulder';

export interface CameraRigOpts {
  defaultMode?: CameraMode;
  /** Seconds to blend when switching modes (0 = snap). */
  blend?: number;
  chase?: { distance: number; height: number; lookAhead: number };
  orbit?: { distance: number; height: number; pitch: number };
  shoulder?: { distance: number; height: number; side: number; lookAhead: number };
}

export class CameraRig {
  mode: CameraMode;
  private blend: number;
  private t = 1; // 1 = fully settled
  private fromPos = new THREE.Vector3();
  private fromQuat = new THREE.Quaternion();
  private chase: { distance: number; height: number; lookAhead: number };
  private orbit: { distance: number; height: number; pitch: number };
  private shoulder: { distance: number; height: number; side: number; lookAhead: number };
  // scratch — no per-frame allocs
  private _pos = new THREE.Vector3();
  private _look = new THREE.Vector3();
  private _tmp = new THREE.Object3D();

  constructor(private camera: THREE.PerspectiveCamera, opts: CameraRigOpts = {}) {
    this.mode = opts.defaultMode ?? 'fps';
    this.blend = opts.blend ?? 0.18;
    this.chase = opts.chase ?? { distance: 6, height: 2.2, lookAhead: 2 };
    this.orbit = opts.orbit ?? { distance: 18, height: 14, pitch: 0.7 };
    this.shoulder = opts.shoulder ?? { distance: 4.2, height: 1.55, side: 0.65, lookAhead: 8 };
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.fromPos.copy(this.camera.position);
    this.fromQuat.copy(this.camera.quaternion);
    this.mode = mode;
    this.t = 0;
  }

  /**
   * Drive the camera toward the target pose for the active mode.
   * `target` is the player / unit world position; `yaw` is facing (radians).
   */
  update(dt: number, target: THREE.Vector3, yaw: number): void {
    const pos = this._pos;
    const look = this._look;

    switch (this.mode) {
      case 'fps': {
        // eye height is owned by the character controller; rig only sets rotation
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.set(this.camera.rotation.x, yaw, 0);
        this.settle(dt);
        return;
      }
      case 'chase': {
        const c = this.chase;
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        pos.set(target.x + sin * c.distance, target.y + c.height, target.z + cos * c.distance);
        look.set(target.x - sin * c.lookAhead, target.y + 1.2, target.z - cos * c.lookAhead);
        break;
      }
      case 'orbit': {
        const o = this.orbit;
        pos.set(
          target.x + Math.cos(yaw * 0.15) * o.distance,
          target.y + o.height,
          target.z + Math.sin(yaw * 0.15) * o.distance,
        );
        look.copy(target);
        break;
      }
      case 'shoulder': {
        const sh = this.shoulder;
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        // behind + slight right shoulder offset
        pos.set(
          target.x + sin * sh.distance + cos * sh.side,
          target.y + sh.height,
          target.z + cos * sh.distance - sin * sh.side,
        );
        look.set(
          target.x - sin * sh.lookAhead,
          target.y + 1.25,
          target.z - cos * sh.lookAhead,
        );
        break;
      }
      case 'free':
      default:
        this.settle(dt);
        return;
    }

    const tmp = this._tmp;
    tmp.position.copy(pos);
    tmp.lookAt(look);

    if (this.t < 1 && this.blend > 0) {
      this.t = Math.min(1, this.t + dt / this.blend);
      const k = this.t * this.t * (3 - 2 * this.t); // smoothstep
      this.camera.position.lerpVectors(this.fromPos, pos, k);
      this.camera.quaternion.slerpQuaternions(this.fromQuat, tmp.quaternion, k);
    } else {
      this.camera.position.copy(pos);
      this.camera.quaternion.copy(tmp.quaternion);
    }
  }

  private settle(dt: number): void {
    if (this.t < 1) this.t = Math.min(1, this.t + dt / Math.max(this.blend, 1e-3));
  }
}
