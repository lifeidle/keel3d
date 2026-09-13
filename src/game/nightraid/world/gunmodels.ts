// Procedural weapon models built from primitives (no external assets).
// - buildGunModel(key): first-person viewmodels, one per weapon slot
//   (each carries a named 'muzzle' Object3D marker at the barrel tip so
//   effects can spawn exactly at the muzzle, plus stylized arms/hands)
// - buildEnemyGun(key): world-scale guns carried by enemy archetypes
// Each call creates fresh materials so callers can traverse-dispose safely.
import * as THREE from 'three';
import { metalTexture } from '../../../world/textures';

function box(
  w: number, h: number, d: number,
  mat: THREE.Material,
  x: number, y: number, z: number,
  parent: THREE.Group,
  rx = 0, rz = 0
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  m.rotation.z = rz;
  parent.add(m);
  return m;
}

function cylZ(
  r: number, len: number,
  mat: THREE.Material,
  x: number, y: number, z: number,
  parent: THREE.Group
) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.rotation.x = Math.PI / 2; // align along Z (muzzle = -Z)
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Invisible muzzle marker: effects resolve its world position each shot. */
function muzzleMarker(g: THREE.Group, y: number, z: number) {
  const mz = new THREE.Object3D();
  mz.name = 'muzzle';
  mz.position.set(0, y, z);
  g.add(mz);
}

/** Three short finger boxes curling over a grip/foregrip. */
function fingers(g: THREE.Group, mat: THREE.Material, x: number, y: number, z: number) {
  for (let i = 0; i < 3; i++) {
    box(0.018, 0.018, 0.05, mat, x, y - i * 0.022, z, g);
  }
}

/** Stylized forearms + gloves (with curled fingers) on the foregrip / grip. */
function arms(
  g: THREE.Group,
  sleeve: THREE.Material,
  glove: THREE.Material,
  fore: [number, number, number],
  grip: [number, number, number]
) {
  // left arm reaching forward to the foregrip (shoulder off-screen lower-left)
  const ls = box(0.05, 0.05, 0.26, sleeve, fore[0] - 0.045, fore[1] - 0.06, fore[2] + 0.13, g, 0.45, 0.42);
  ls.rotation.y = -0.15;
  box(0.045, 0.05, 0.06, glove, fore[0], fore[1], fore[2], g);
  fingers(g, glove, fore[0] - 0.014, fore[1] - 0.005, fore[2] - 0.03);
  // right arm from off-screen lower-right to the grip
  const rs = box(0.05, 0.05, 0.3, sleeve, grip[0] + 0.078, grip[1] - 0.095, grip[2] + 0.19, g, 0.55, -0.32);
  rs.rotation.y = 0.12;
  box(0.045, 0.06, 0.055, glove, grip[0], grip[1], grip[2], g);
  fingers(g, glove, grip[0] + 0.012, grip[1] - 0.005, grip[2] - 0.028);
}

/** Top Picatinny-style rail (thin ribbed strip) along the receiver. */
function rail(g: THREE.Group, mat: THREE.Material, len: number, y: number, z: number) {
  box(0.012, 0.018, len, mat, 0, y, z, g);
  const n = Math.floor(len / 0.03);
  for (let i = 0; i < n; i++) {
    box(0.02, 0.022, 0.006, mat, 0, y + 0.012, z - len / 2 + 0.015 + i * 0.03, g);
  }
}

/** Magazine with a row of visible round tips (brass hints). */
function magRounds(g: THREE.Group, body: THREE.Material, brass: THREE.Material, x: number, y: number, z: number, n: number) {
  box(0.03, 0.16, 0.05, body, x, y, z, g, 0.18);
  for (let i = 0; i < n; i++) {
    box(0.022, 0.012, 0.012, brass, x, y + 0.06 - i * 0.022, z + 0.028, g);
  }
}

function mats() {
  const steelMap = metalTexture();
  return {
    steel: new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.42, metalness: 0.7, map: steelMap }),
    dark: new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.5, metalness: 0.75, map: steelMap }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5e452c, roughness: 0.85 }),
    wood2: new THREE.MeshStandardMaterial({ color: 0x6b5233, roughness: 0.85 }),
    sight: new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.4, metalness: 0.55, map: steelMap }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x1a2a38, roughness: 0.2, metalness: 0.4, emissive: 0x0a1824, emissiveIntensity: 0.6,
    }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x37402f, roughness: 0.9 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x4d3f2f, roughness: 0.8 }),
  };
}

/** First-person viewmodel per weapon slot. Built around its own origin; the
 *  caller positions it relative to the camera (muzzle points down -Z). */
export function buildGunModel(key: string): THREE.Group {
  const g = new THREE.Group();
  const m = mats();

  if (key === 'rifle') {
    // Garand-flavoured: wood furniture, long barrel, no detachable mag
    box(0.05, 0.09, 0.22, m.wood, 0, -0.02, 0.12, g);       // butt stock
    box(0.055, 0.07, 0.3, m.steel, 0, 0.01, -0.05, g);      // receiver
    box(0.05, 0.05, 0.22, m.wood2, 0, 0.005, -0.28, g);     // handguard
    cylZ(0.012, 0.25, m.dark, 0, 0.01, -0.5, g);            // barrel
    box(0.008, 0.03, 0.01, m.sight, 0, 0.035, -0.6, g);     // front sight
    box(0.03, 0.015, 0.02, m.steel, 0, 0.05, -0.12, g);     // rear sight
    box(0.012, 0.045, 0.05, m.dark, 0, -0.045, 0.0, g);     // trigger group
    rail(g, m.dark, 0.28, 0.055, -0.05);                    // top rail
    muzzleMarker(g, 0.01, -0.63);
    arms(g, m.sleeve, m.glove, [0, -0.035, -0.26], [0, -0.06, 0.0]);
  } else if (key === 'smg') {
    // PPSh-flavoured: round receiver shroud, curved-looking mag
    box(0.05, 0.08, 0.16, m.wood, 0, -0.02, 0.1, g);        // butt stock
    cylZ(0.032, 0.34, m.steel, 0, 0.01, -0.1, g);           // receiver shroud
    cylZ(0.014, 0.12, m.dark, 0, 0.01, -0.33, g);           // barrel
    magRounds(g, m.steel, m.sight, 0, -0.09, -0.16, 6);     // drum mag with rounds
    box(0.035, 0.09, 0.04, m.wood2, 0, -0.06, 0.03, g);     // grip
    box(0.01, 0.025, 0.01, m.sight, 0, 0.05, -0.36, g);     // front sight
    rail(g, m.dark, 0.16, 0.055, 0.1);
    muzzleMarker(g, 0.01, -0.4);
    arms(g, m.sleeve, m.glove, [0, -0.04, -0.2], [0, -0.065, 0.03]);
  } else if (key === 'carbine') {
    // M1-Carbine-flavoured: slim, short, small box mag
    box(0.045, 0.08, 0.24, m.wood, 0, -0.015, 0.1, g);      // butt stock
    box(0.045, 0.055, 0.22, m.steel, 0, 0.01, -0.06, g);    // receiver
    cylZ(0.011, 0.28, m.dark, 0, 0.012, -0.32, g);          // barrel
    magRounds(g, m.steel, m.sight, 0, -0.045, -0.02, 4);    // box mag with rounds
    box(0.008, 0.025, 0.01, m.sight, 0, 0.03, -0.44, g);    // front sight
    box(0.012, 0.04, 0.04, m.dark, 0, -0.04, 0.03, g);      // grip
    rail(g, m.dark, 0.2, 0.05, -0.06);
    muzzleMarker(g, 0.012, -0.47);
    arms(g, m.sleeve, m.glove, [0, -0.03, -0.2], [0, -0.05, 0.03]);
  } else {
    // bolt: Kar98-flavoured long barrel + bolt handle + scope (night ops)
    box(0.05, 0.085, 0.3, m.wood, 0, -0.01, 0.14, g);       // butt stock
    box(0.05, 0.06, 0.18, m.steel, 0, 0.005, -0.08, g);     // receiver
    rail(g, m.dark, 0.12, 0.05, 0.04);                      // rail behind the scope
    cylZ(0.013, 0.42, m.dark, 0, 0.01, -0.38, g);           // barrel
    const bolt = cylZ(0.008, 0.05, m.steel, 0, 0, -0.02, g);
    bolt.rotation.z = Math.PI / 2; // bolt along X
    bolt.position.set(0.045, 0.01, -0.02);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), m.steel);
    knob.position.set(0.07, 0.01, -0.02);
    g.add(knob);
    cylZ(0.02, 0.14, m.dark, 0, 0.065, -0.06, g);           // scope tube
    cylZ(0.024, 0.02, m.glass, 0, 0.065, -0.135, g);        // scope objective
    box(0.01, 0.02, 0.02, m.steel, 0, 0.05, 0.0, g);        // scope mount
    box(0.008, 0.028, 0.01, m.sight, 0, 0.032, -0.58, g);   // front sight
    muzzleMarker(g, 0.01, -0.6);
    arms(g, m.sleeve, m.glove, [0, -0.035, -0.3], [0, -0.055, 0.05]);
  }
  return g;
}

/** World-scale gun for an enemy archetype. Built pointing down -Z (muzzle at -Z),
 *  matching the first-person viewmodels so the caller can orient it uniformly. */
export function buildEnemyGun(key: string): THREE.Group {
  const g = new THREE.Group();
  const m = mats();

  if (key === 'smg') {
    box(0.05, 0.08, 0.12, m.wood, 0, -0.02, 0.1, g);        // stock
    cylZ(0.03, 0.26, m.steel, 0, 0.01, -0.08, g);           // round receiver shroud
    cylZ(0.014, 0.1, m.dark, 0, 0.01, -0.24, g);            // barrel
    box(0.03, 0.13, 0.05, m.steel, 0, -0.08, -0.06, g, 0.2); // curved mag
    box(0.03, 0.08, 0.04, m.wood2, 0, -0.05, 0.06, g);      // grip
    muzzleMarker(g, 0.006, -0.31);
  } else if (key === 'marksman') {
    box(0.05, 0.07, 0.2, m.wood, 0, -0.01, 0.06, g);        // stock
    box(0.05, 0.06, 0.16, m.steel, 0, 0.005, -0.06, g);     // receiver
    cylZ(0.012, 0.3, m.dark, 0, 0.005, -0.3, g);            // long barrel
    box(0.028, 0.05, 0.05, m.dark, 0, -0.06, -0.02, g);     // mag
    cylZ(0.018, 0.12, m.dark, 0, 0.055, -0.04, g);          // scope tube
    cylZ(0.021, 0.02, m.glass, 0, 0.055, -0.1, g);          // scope lens
    muzzleMarker(g, 0.005, -0.47);
  } else {
    box(0.05, 0.07, 0.18, m.wood, 0, -0.01, 0.1, g);        // wood stock
    box(0.05, 0.06, 0.16, m.steel, 0, 0.005, -0.05, g);     // receiver
    cylZ(0.012, 0.22, m.dark, 0, 0.005, -0.26, g);          // barrel
    box(0.028, 0.1, 0.05, m.steel, 0, -0.06, -0.02, g);     // mag
    box(0.03, 0.05, 0.04, m.dark, 0, -0.04, 0.05, g);       // grip
    muzzleMarker(g, 0.005, -0.39);
  }
  return g;
}
