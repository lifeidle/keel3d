/**
 * ViewmodelSlots — multi-slot first-person viewmodel manager.
 *
 * FPS recipes with several guns need: one viewmodel object per slot, all
 * attached to the camera, exactly one visible at a time, and a cheap
 * recoil/kick animation per switch. This block owns that mechanism; the
 * recipe owns building the actual model meshes.
 *
 * Thin three.js wrapper (Object3D add/remove/visible — no WebGL), so it is
 * headless-testable with node + three. The animation is a pure damped
 * impulse: `kick(amount)` adds to a decaying offset applied to the slot's
 * rest pose (exponential damp, dt-correct).
 */
import * as THREE from 'three';

/**
 * Exponential smoothing (dt-correct): frame-rate independent "move toward".
 * Pure — headless testable.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export interface ViewmodelSlotDef {
  /** The viewmodel root (added to the camera). */
  object: THREE.Object3D;
  /** Rest pose relative to the camera. */
  basePos: THREE.Vector3;
}

const KICK_DECAY = 8; // 1/s — settles in ~0.4s
const KICK_Z = 0.45; // how much of the kick pushes the gun back
const KICK_Y = 0.18; // and lifts it

export class ViewmodelSlots {
  private slots: (ViewmodelSlotDef & { kick: number })[] = [];
  private camera: THREE.Object3D;
  private cur = -1;

  constructor(camera: THREE.Object3D) {
    this.camera = camera;
  }

  get count(): number {
    return this.slots.length;
  }

  get activeIndex(): number {
    return this.cur;
  }

  /**
   * Register a viewmodel slot: attached to the camera. The FIRST slot is
   * activated automatically (visible); later slots stay hidden until
   * `setSlot`. Returns the slot index.
   */
  addSlot(object: THREE.Object3D, basePos: THREE.Vector3 = new THREE.Vector3(0.2, -0.19, -0.42)): number {
    const idx = this.slots.length;
    const slot = { object, basePos: basePos.clone(), kick: 0 };
    this.slots.push(slot);
    cameraAdd(this.camera, object);
    object.visible = false;
    if (this.cur === -1) {
      this.cur = idx;
      object.visible = true;
      object.position.copy(slot.basePos);
    }
    return idx;
  }

  /** Show exactly this slot (hide the rest). No-op if already active. */
  setSlot(index: number): boolean {
    const n = this.slots.length;
    if (n === 0) return false;
    const i = ((index % n) + n) % n;
    if (i === this.cur) return false;
    for (let s = 0; s < n; s++) this.slots[s].object.visible = s === i;
    this.cur = i;
    return true;
  }

  /** Recoil / reload impulse on the active slot (decays in update). */
  kick(amount = 0.06): void {
    if (this.cur < 0) return;
    this.slots[this.cur].kick = Math.min(0.5, this.slots[this.cur].kick + amount);
  }

  /** Advance the kick decay and apply the offset (call every frame). */
  update(dt: number): void {
    const slot = this.slots[this.cur];
    if (!slot) return;
    slot.kick = damp(slot.kick, 0, KICK_DECAY, dt);
    if (slot.kick < 0.001) slot.kick = 0;
    slot.object.position.set(
      slot.basePos.x,
      slot.basePos.y + slot.kick * KICK_Y,
      slot.basePos.z + slot.kick * KICK_Z,
    );
  }

  /** Current slot's rest pose (for muzzle anchor offsets etc.). */
  basePos(index = this.cur): THREE.Vector3 | null {
    const s = this.slots[index];
    return s ? s.basePos : null;
  }

  dispose(): void {
    for (const s of this.slots) {
      try {
        this.camera.remove(s.object);
      } catch {
        /* already removed */
      }
    }
    this.slots.length = 0;
    this.cur = -1;
  }
}

/** camera.add wrapper tolerant of groups without add (never, but safe). */
function cameraAdd(parent: THREE.Object3D, child: THREE.Object3D): void {
  parent.add(child);
}
