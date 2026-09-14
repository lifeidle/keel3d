// Enemy-camp searchlight (atmosphere batch): a lamp on a mast that slowly
// sweeps a SpotLight across the ground — the classic night-watch silhouette.
// Everything lives inside `group` (light + target + a faint volumetric cone)
// so map disposal removes it wholesale. Cost: one SpotLight, no shadows.
import * as THREE from 'three';

export class Searchlight {
  readonly group = new THREE.Group();
  private light: THREE.SpotLight;
  private target: THREE.Object3D;
  private cone: THREE.Mesh;
  private t = Math.random() * 10;
  private baseYaw: number;
  private hx: number;
  private hz: number;
  private height = 8;
  private gy: number;
  private heightAt: (x: number, z: number) => number;

  constructor(heightAt: (x: number, z: number) => number, x: number, z: number, baseYaw: number) {
    this.heightAt = heightAt;
    this.baseYaw = baseYaw;
    this.hx = x;
    this.hz = z;
    this.gy = heightAt(x, z);
    const steel = new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 0.55, metalness: 0.5 });

    // mast with a crossbar + lamp housing
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, this.height, 8), steel);
    mast.position.set(0, this.gy + this.height / 2, 0);
    mast.castShadow = true;
    this.group.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.85), steel);
    head.position.set(0, this.gy + this.height + 0.18, 0);
    this.group.add(head);

    // the sweeping lamp (no shadows — one spotlight total, lit at night)
    this.light = new THREE.SpotLight(0xfff2cf, 0, 160, 0.4, 0.55, 0.8);
    this.light.position.set(0, this.gy + this.height + 0.05, 0);
    this.light.castShadow = false;
    this.target = new THREE.Object3D();
    this.group.add(this.target);
    this.light.target = this.target;
    this.group.add(this.light);

    // faint additive cone so the beam reads even against the night sky
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2cf,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 16, 1, true), coneMat);
    this.group.add(this.cone);

    this.group.position.set(x, 0, z);
  }

  /**
   * Is a ground point caught in the current beam? Angular test against the
   * swept aim point plus a range cap — the game runs this at night to decide
   * whether the sweep has exposed the player.
   */
  isIlluminating(px: number, pz: number): boolean {
    const reach = 90;
    const a = Math.sin(this.t * 0.55) * 0.66;
    const tx = this.hx + Math.cos(this.baseYaw + a) * reach;
    const tz = this.hz + Math.sin(this.baseYaw + a) * reach;
    // horizontal angle between the beam centre and the point
    const bx = tx - this.hx;
    const bz = tz - this.hz;
    const px2 = px - this.hx;
    const pz2 = pz - this.hz;
    const dot = bx * px2 + bz * pz2;
    const bl = Math.hypot(bx, bz);
    const pl = Math.hypot(px2, pz2);
    if (pl > reach * 1.15 || pl < 3) return false; // too far, or under the mast
    const ang = Math.acos(Math.max(-1, Math.min(1, dot / (bl * pl))));
    return ang < 0.34; // slightly tighter than the visual cone (0.4 rad)
  }

  /** Sweep the beam across the terrain. `enabled` = lit (night) vs dim. */
  update(dt: number, enabled = true) {
    this.t += dt;
    // slow sinusoidal sweep ±38° around the base yaw (~11s full cycle)
    const a = Math.sin(this.t * 0.55) * 0.66;
    const reach = 90;
    const tx = this.hx + Math.cos(this.baseYaw + a) * reach;
    const tz = this.hz + Math.sin(this.baseYaw + a) * reach;
    const ty = this.heightAt(tx, tz) + 1.4; // skim just over the ground
    this.target.position.set(tx - this.hx, ty, tz - this.hz);

    const want = enabled ? 60 : 0;
    if (this.light.intensity !== want) this.light.intensity = want;
    // the fake beam cone is day-blind too — no ghost searchlights at noon
    if (this.cone.visible !== enabled) this.cone.visible = enabled;

    // aim the volumetric cone along the beam
    const lp = this.light.position;
    const tp = this.target.position;
    const dx = tp.x - lp.x;
    const dy = tp.y - lp.y;
    const dz = tp.z - lp.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1) return;
    this.cone.position.copy(lp);
    this.cone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx / len, dy / len, dz / len)
    );
    const r = Math.tan(0.4) * len * 0.9;
    this.cone.scale.set(r, len, r);
  }
}
