/**
 * kitGun — blocky weapon viewmodel built from primitives (no assets).
 * Mechanism-equivalent to the original nightraid gunmodels: a body + barrel
 * + mag + iron sight group carrying a named 'muzzle' Object3D at the barrel
 * tip (effects spawn exactly there), plus optional stylized forearms/gloves
 * gripping the foregrip and grip.
 *
 * Orientation convention: muzzle points along -Z (camera forward).
 * Callers create fresh materials per model so traverse-dispose is safe.
 */
import * as THREE from 'three';

export interface KitGunOpts {
  /** Metal colour (barrel + body frame). */
  metal?: number;
  /** Polymer colour (body, mag, grip). */
  polymer?: number;
  /** Barrel length in local units (default 0.55). */
  barrel?: number;
  /** Total body length (default 0.85). */
  length?: number;
  /** Add stylized forearms + gloves gripping the gun (FPV look). */
  arms?: boolean;
  /** Muzzle Y/Z offset is computed from the barrel automatically. */
}

export interface KitGun {
  /** Root group — parent under the camera (positioned by the game). */
  group: THREE.Group;
  /** Named muzzle marker at the barrel tip (world-resolved per shot). */
  muzzle: THREE.Object3D;
  /** Metal material (recoil tint / wear). */
  metalMat: THREE.MeshStandardMaterial;
}

function box(
  w: number, h: number, d: number,
  mat: THREE.Material,
  x: number, y: number, z: number,
  parent: THREE.Group,
  rx = 0, rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.rotation.z = rz;
  parent.add(m);
  return m;
}

/**
 * Build a blocky rifle/SMG viewmodel. Total height ≈ 0.18, length from opts.
 * Muzzle sits at (0, ~0.04, -(barrel end)) — the game reads
 * `muzzle.getWorldPosition()` per shot for tracers/flash.
 */
export function kitGun(opts: KitGunOpts = {}): KitGun {
  const metalMat = new THREE.MeshStandardMaterial({
    color: opts.metal ?? 0x3a3f48,
    roughness: 0.45,
    metalness: 0.55,
  });
  const polymerMat = new THREE.MeshStandardMaterial({
    color: opts.polymer ?? 0x24282e,
    roughness: 0.85,
    metalness: 0.05,
  });
  const group = new THREE.Group();
  const L = opts.length ?? 0.85;
  const B = opts.barrel ?? 0.55;

  // body block (receiver) — front half
  box(L * 0.62, 0.14, 0.09, polymerMat, 0, 0, -L * 0.18, group);
  // barrel (metal, along -Z)
  const barrelZ = -(L * 0.62 + B * 0.5);
  box(0.05, 0.05, B, metalMat, 0, 0.02, barrelZ, group);
  // muzzle brake (slightly wider ring at the tip)
  box(0.07, 0.07, 0.05, metalMat, 0, 0.02, barrelZ - B * 0.45, group);
  // mag (angled under the front body)
  box(0.07, 0.16, 0.09, polymerMat, 0, -0.13, -L * 0.22, group, -0.25);
  // grip (rear, angled)
  box(0.06, 0.13, 0.07, polymerMat, 0, -0.11, L * 0.28, group, 0.4);
  // iron sight: two posts + top bar
  box(0.03, 0.04, 0.03, metalMat, 0, 0.09, -L * 0.4, group);
  box(0.03, 0.04, 0.03, metalMat, 0, 0.09, L * 0.1, group);
  box(0.05, 0.02, L * 0.5, metalMat, 0, 0.11, -L * 0.15, group);

  // muzzle marker at the barrel tip (invisible; effects resolve it)
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, 0.02, barrelZ - B * 0.5);
  group.add(muzzle);

  // optional stylized arms (sleeve → glove → three curled fingers per hand)
  if (opts.arms) {
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x4a4f3a, roughness: 0.9 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x2c2c26, roughness: 0.95 });
    const fingers = (x: number, y: number, z: number) => {
      for (let i = 0; i < 3; i++) {
        box(0.018, 0.018, 0.05, gloveMat, x, y - i * 0.022, z, group);
      }
    };
    // left arm reaching to the foregrip (front third of the barrel)
    const fx = 0, fy = -0.06, fz = -L * 0.35;
    const ls = box(0.05, 0.05, 0.26, sleeveMat, fx - 0.045, fy - 0.06, fz + 0.13, group, 0.45, 0.42);
    ls.rotation.y = -0.15;
    box(0.045, 0.05, 0.06, gloveMat, fx, fy, fz, group);
    fingers(fx - 0.014, fy - 0.005, fz - 0.03);
    // right arm to the grip
    const gx = 0, gy = -0.09, gz = L * 0.28;
    const rs = box(0.05, 0.05, 0.3, sleeveMat, gx + 0.078, gy - 0.095, gz + 0.19, group, 0.55, -0.32);
    rs.rotation.y = 0.12;
    box(0.045, 0.06, 0.055, gloveMat, gx, gy, gz, group);
    fingers(gx + 0.012, gy - 0.005, gz - 0.028);
  }

  return { group, muzzle, metalMat };
}
