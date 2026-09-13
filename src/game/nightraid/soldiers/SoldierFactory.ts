/**
 * SoldierFactory — shared materials + merged body meshes.
 * Keeps the blocky-soldier silhouette while cutting per-soldier materials
 * from 5 unique to 5 shared (per side+palette) and mesh count from ~18 to ~6.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { materials } from '../../../engine/render/MaterialCache';

export type SoldierSide = 'ally' | 'enemy';

export interface SoldierPalette {
  body: number;
  helmet: number;
  emissive: number;
  head: number;
  vest: number;
  boot: number;
}

const DEFAULT_HEAD = 0xb98a6a;
const DEFAULT_VEST = 0x171a14;
const DEFAULT_BOOT = 0x14110d;

/** Fabric bump shared across all uniforms — one texture, many materials. */
let fabricTex: THREE.Texture | null = null;
export function fabricTexture(): THREE.Texture {
  if (fabricTex) return fabricTex;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 900; i++) {
    const v = 90 + ((Math.random() * 50) | 0);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
  }
  fabricTex = new THREE.CanvasTexture(c);
  fabricTex.wrapS = fabricTex.wrapT = THREE.RepeatWrapping;
  fabricTex.repeat.set(2, 2);
  return fabricTex;
}

interface Mats {
  body: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  helmet: THREE.MeshStandardMaterial;
  vest: THREE.MeshStandardMaterial;
  boot: THREE.MeshStandardMaterial;
}

const matCache = new Map<string, Mats>();

function matsFor(side: SoldierSide, bodyColor: number, emissiveIntensity: number): Mats {
  const k = `${side}|${bodyColor}|${emissiveIntensity.toFixed(3)}`;
  let m = matCache.get(k);
  if (!m) {
    m = {
      body: materials.standard({
        color: bodyColor,
        roughness: 0.85,
        metalness: 0.05,
        map: fabricTexture(),
        emissive: bodyColor,
        emissiveIntensity,
      }),
      head: materials.standard({ color: DEFAULT_HEAD, roughness: 0.8 }),
      helmet: materials.standard({
        color: side === 'ally' ? 0x6f7a52 : 0x3a4046,
        roughness: 0.5,
        metalness: 0.45,
      }),
      vest: materials.standard({ color: DEFAULT_VEST, roughness: 0.92 }),
      boot: materials.standard({ color: DEFAULT_BOOT, roughness: 0.95 }),
    };
    matCache.set(k, m);
  }
  return m;
}

/** Clone-safe shared material lookup (hit-flash mutates emissiveIntensity). */
export function soldierMaterials(side: SoldierSide, bodyColor: number, emissiveIntensity: number): Mats {
  return matsFor(side, bodyColor, emissiveIntensity);
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export interface SoldierRig {
  mesh: THREE.Group;
  pivot: THREE.Group;
  armB: THREE.Group;
  armF: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** merged static torso (vest+shoulders+head+helmet) — 1 draw */
  torso: THREE.Mesh;
  /** body-tinted limbs that swing (arms content lives in arm groups) */
  mats: Mats;
}

/**
 * Build the blocky soldier. Mesh budget:
 *  1 merged torso (body+vest+shoulders+head+helmet+brim)
 *  2 arm groups × 1 merged arm mesh each
 *  2 leg groups × 1 merged leg mesh each
 *  = 5 meshes + groups  (was ~18)
 */
export function buildSoldierRig(side: SoldierSide, bodyColor: number, emissiveIntensity: number): SoldierRig {
  const mats = matsFor(side, bodyColor, emissiveIntensity);
  const mesh = new THREE.Group();
  const pivot = new THREE.Group();
  mesh.add(pivot);

  // --- torso: everything that never animates independently ---
  const torsoParts: THREE.BufferGeometry[] = [];
  const torsoVest: THREE.BufferGeometry[] = [];
  const torsoHead: THREE.BufferGeometry[] = [];
  const torsoHelmet: THREE.BufferGeometry[] = [];

  torsoParts.push(box(0.34, 0.52, 0.22, 0, 0.12, 0));
  torsoParts.push(box(0.1, 0.13, 0.24, -0.21, 0.32, 0));
  torsoParts.push(box(0.1, 0.13, 0.24, 0.21, 0.32, 0));
  torsoVest.push(box(0.37, 0.44, 0.26, 0, 0.08, 0.03));
  torsoHead.push(box(0.17, 0.2, 0.17, 0, 0.47, 0));
  {
    const helmet = new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    helmet.translate(0, 0.485, 0);
    torsoHelmet.push(helmet);
    torsoHelmet.push(box(0.23, 0.035, 0.23, 0, 0.46, 0));
  }

  // Four sub-meshes for 4 material slots — still a huge cut vs 18 Object3Ds.
  const torso = new THREE.Group();
  const bodyMesh = new THREE.Mesh(mergeGeometries(torsoParts, false)!, mats.body);
  const vestMesh = new THREE.Mesh(mergeGeometries(torsoVest, false)!, mats.vest);
  const headMesh = new THREE.Mesh(mergeGeometries(torsoHead, false)!, mats.head);
  const helmetMesh = new THREE.Mesh(mergeGeometries(torsoHelmet, false)!, mats.helmet);
  torso.add(bodyMesh, vestMesh, headMesh, helmetMesh);
  pivot.add(torso);

  // --- arms (1 mesh each: upper+fore merged, body material) ---
  const armB = new THREE.Group();
  {
    const parts = [
      box(0.1, 0.28, 0.1, 0, -0.14, 0),
      box(0.09, 0.26, 0.1, 0.05, -0.34, 0),
    ];
    armB.add(new THREE.Mesh(mergeGeometries(parts, false)!, mats.body));
    armB.position.set(0.22, 0.3, -0.02);
    armB.rotation.set(0.35, 0, 0.25);
  }
  const armF = new THREE.Group();
  {
    const parts = [
      box(0.1, 0.28, 0.1, 0, -0.13, 0),
      box(0.09, 0.26, 0.1, 0, -0.27, 0.04),
    ];
    armF.add(new THREE.Mesh(mergeGeometries(parts, false)!, mats.body));
    armF.position.set(0.2, 0.27, 0);
    armF.rotation.x = 1.05;
  }
  pivot.add(armB, armF);

  // --- legs (1 mesh each: thigh+shin+boot) ---
  const mkLeg = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, -0.14, 0);
    const body = new THREE.Mesh(
      mergeGeometries(
        [box(0.12, 0.32, 0.14, 0, -0.16, 0), box(0.11, 0.32, 0.13, 0, -0.5, 0)],
        false
      )!,
      mats.body
    );
    const boot = new THREE.Mesh(box(0.13, 0.11, 0.21, 0, -0.7, 0.03), mats.boot);
    g.add(body, boot);
    pivot.add(g);
    return g;
  };
  const legL = mkLeg(-0.1);
  const legR = mkLeg(0.1);

  return {
    mesh,
    pivot,
    armB,
    armF,
    legL,
    legR,
    torso: torso as unknown as THREE.Mesh,
    mats,
  };
}
