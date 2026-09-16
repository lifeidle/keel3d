/**
 * kitSoldier — blocky humanoid figure (torso/vest/head/helmet + rigged
 * arms & legs) built from primitives. Mechanism-equivalent to the original
 * nightraid SoldierFactory silhouette, but as a reusable block with a
 * walk-pose API (legs swing) that the original rig did not expose.
 *
 * No external assets: every part is a box/hemisphere; materials are created
 * per call (callers with many instances should cache by palette).
 */
import * as THREE from 'three';

export interface SoldierPalette {
  /** Uniform body colour (arms + torso base). */
  body: number;
  /** Helmet colour (per side). */
  helmet: number;
  /** Night/hit emissive on the body material (0..1). */
  emissive?: number;
  /** Head skin tone. */
  head?: number;
  /** Body armour vest colour. */
  vest?: number;
  /** Boot colour. */
  boot?: number;
  /**
   * Optional fabric map for the body material (clothTexture / fabricTexture)
   * — makes blocky uniforms read as cloth. Headless: pass a 1×1 texture.
   */
  bodyMap?: THREE.Texture;
}

export interface SoldierRig {
  /** Root group — position/rotate the whole soldier. */
  root: THREE.Group;
  /** Hip pivot — everything above rides here. */
  pivot: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** Merged static torso (body+vest+shoulders+head+helmet) meshes. */
  torso: THREE.Group;
  /** Body-tinted material (hit-flash target). */
  bodyMat: THREE.MeshStandardMaterial;
  /**
   * Pose the legs for a walk cycle (phase = radians). Arms counter-swing.
   * phase 0 = legs together; amplitude auto-scaled by `swing` (0..1).
   */
  setWalk: (phase: number, swing?: number) => void;
}

const DEFAULTS = {
  head: 0xb98a6a,
  vest: 0x171a14,
  boot: 0x14110d,
};

function box(
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  mat: THREE.Material,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/**
 * Build one blocky soldier. Height ≈ 1.8u (hip pivot at y = 0.95).
 * Mesh budget per soldier: torso group (4 merged meshes) + 2 arms + 2 legs.
 */
export function kitSoldier(p: SoldierPalette): SoldierRig {
  const bodyMat = new THREE.MeshStandardMaterial({
    color: p.body,
    roughness: 0.85,
    metalness: 0.05,
    map: p.bodyMap ?? null,
    emissive: p.body,
    emissiveIntensity: p.emissive ?? 0,
  });
  const headMat = new THREE.MeshStandardMaterial({ color: p.head ?? DEFAULTS.head, roughness: 0.8 });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: p.helmet,
    roughness: 0.5,
    metalness: 0.45,
  });
  const vestMat = new THREE.MeshStandardMaterial({ color: p.vest ?? DEFAULTS.vest, roughness: 0.92 });
  const bootMat = new THREE.MeshStandardMaterial({ color: p.boot ?? DEFAULTS.boot, roughness: 0.95 });

  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = 0.95; // hip height
  root.add(pivot);

  // ---- torso group (body + shoulders + head + helmet dome + brim) ----
  const torso = new THREE.Group();
  torso.add(box(0.34, 0.52, 0.22, 0, 0.12, 0, bodyMat)); // chest
  torso.add(box(0.1, 0.13, 0.24, -0.21, 0.32, 0, bodyMat)); // shoulder L
  torso.add(box(0.1, 0.13, 0.24, 0.21, 0.32, 0, bodyMat)); // shoulder R
  torso.add(box(0.37, 0.44, 0.26, 0, 0.08, 0.03, vestMat)); // vest
  torso.add(box(0.17, 0.2, 0.17, 0, 0.47, 0, headMat)); // head
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    helmetMat,
  );
  dome.position.set(0, 0.485, 0);
  torso.add(dome);
  torso.add(box(0.23, 0.035, 0.23, 0, 0.46, 0, helmetMat)); // brim
  pivot.add(torso);

  // ---- arms (shoulder pivot; front arm holds a weapon: bent forward) ----
  const armL = new THREE.Group();
  armL.position.set(-0.22, 0.3, -0.02);
  armL.add(box(0.1, 0.28, 0.1, 0, -0.14, 0, bodyMat)); // upper
  armL.add(box(0.09, 0.26, 0.1, 0, -0.34, 0.05, bodyMat)); // fore
  armL.rotation.set(0.35, 0, -0.25);
  pivot.add(armL);

  const armR = new THREE.Group();
  armR.position.set(0.22, 0.27, 0);
  armR.add(box(0.1, 0.28, 0.1, 0, -0.13, 0, bodyMat));
  armR.add(box(0.09, 0.26, 0.1, 0, -0.27, 0.04, bodyMat));
  armR.rotation.x = 1.05; // weapon-carry pose
  pivot.add(armR);

  // ---- legs (hip pivot; thigh + shin + boot) ----
  const mkLeg = (x: number): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(x, -0.05, 0);
    g.add(box(0.12, 0.32, 0.14, 0, -0.16, 0, bodyMat)); // thigh
    g.add(box(0.11, 0.32, 0.13, 0, -0.5, 0, bodyMat)); // shin
    g.add(box(0.13, 0.11, 0.21, 0, -0.7, 0.03, bootMat)); // boot
    pivot.add(g);
    return g;
  };
  const legL = mkLeg(-0.1);
  const legR = mkLeg(0.1);

  const setWalk = (phase: number, swing = 1) => {
    const a = 0.55 * Math.min(1, Math.max(0, swing));
    legL.rotation.x = Math.sin(phase) * a;
    legR.rotation.x = -Math.sin(phase) * a;
    armL.rotation.x = 0.35 - Math.sin(phase) * a * 0.6;
    armR.rotation.x = 1.05 + Math.sin(phase) * a * 0.4;
  };

  return { root, pivot, armL, armR, legL, legR, torso, bodyMat, setWalk };
}
