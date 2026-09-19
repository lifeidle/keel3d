// Static battlefield vehicle hulks + wire + MG nests (scenery layer).
//
// Procedural box/cylinder assembly frozen as *static props*: hulks make great
// low-slung hard cover, none of them move, drive or shoot, and they add ZERO
// lights. Colliders are single low boxes so AI that beelines at the player
// slides around them the same way it does walls.
//
// Transform scheme: each prop's own Group carries the yaw rotation, so child
// meshes are authored in clean local coordinates and can freely rotate around
// their own axes (drooped guns, planted wings). Colliders are static boxes —
// Rapier ones can't rotate here — so every collider centre is hand-rotated by
// yawOf() and the half-extents swapped when the yaw is an odd quarter turn.
//
// Block-layer: no game/ imports. Physics and terrain are injected as minimal
// structural surfaces (satisfied by PhysicsWorld / Terrain).
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import type { SmokeColumns } from '../fx/SmokeColumns';

/** Injected static-physics surface (satisfied by PhysicsWorld). */
export interface HulkPhysics {
  addStaticBox(
    pos: { x: number; y: number; z: number },
    half: { x: number; y: number; z: number }
  ): RAPIER.Collider;
}

/** Injected terrain sampler (satisfied by Terrain). */
export interface HulkTerrain {
  heightAt(x: number, z: number): number;
}

export interface PropHandles {
  colliders: RAPIER.Collider[];
  /**
   * The prop's root group (R83). Content may reposition/reorient it after
   * placement (e.g. a drivable vehicle's hulk follows its driver). Child
   * meshes are authored in the group's local space at the PROP's spawn
   * ground height, so content must compensate `group.position.y` when
   * moving the prop to a spot with different terrain height. Colliders are
   * static — moving the group does NOT move physics.
   */
  group: THREE.Group;
}

function snapYaw(rand: () => number): number {
  return ((rand() * 4) | 0) * (Math.PI / 2);
}

function yawOf(x: number, z: number, yaw: number): [number, number] {
  const c = Math.round(Math.cos(yaw));
  const s = Math.round(Math.sin(yaw));
  return [x * c + z * s, -x * s + z * c];
}

interface Base {
  physics: HulkPhysics;
  terrain: HulkTerrain;
  rand: () => number;
  cx: number;
  cz: number;
  gy0: number;
  yaw: number;
  colliders: RAPIER.Collider[];
  group: THREE.Group; // rotated prop group
}

function makeBase(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): Base {
  const yaw = snapYaw(rand);
  const group = new THREE.Group();
  group.rotation.y = yaw;
  group.position.set(cx, 0, cz);
  g.add(group);
  return {
    physics, terrain, rand, cx, cz,
    gy0: terrain.heightAt(cx, cz),
    yaw, colliders: [], group,
  };
}

/** Box on this prop. `lx/ly/lz` are LOCAL coordinates (yaw applied by the group). */
function box(
  b: Base, color: number, rough: number, metal: number,
  w: number, h: number, d: number,
  lx: number, ly: number, lz: number,
  opts: { collider?: boolean; rotX?: number; rotZ?: number; rotY?: number } = {}
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  mat.color.offsetHSL(0, 0, (b.rand() - 0.5) * 0.06);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  // RIGID prop: every part sits on the prop's OWN ground sample (gy0), never
  // per-part samples ???per-part sampling let tanks disassemble on slopes.
  const gy = b.gy0;
  mesh.position.set(lx, gy + ly + h / 2, lz);
  if (opts.rotX) mesh.rotation.x = opts.rotX;
  if (opts.rotZ) mesh.rotation.z = opts.rotZ;
  if (opts.rotY) mesh.rotation.y = opts.rotY; // local yaw, compounds with the prop's yaw
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  b.group.add(mesh);
  if (opts.collider !== false) {
    const [wx, wz] = yawOf(lx, lz, b.yaw);
    const odd = Math.abs(Math.cos(b.yaw)) < 0.5;
    b.colliders.push(
      b.physics.addStaticBox(
        { x: b.cx + wx, y: b.gy0 + ly + h / 2, z: b.cz + wz },
        odd ? { x: d / 2, y: h / 2, z: w / 2 } : { x: w / 2, y: h / 2, z: d / 2 }
      )
    );
  }
  return mesh;
}

/** a thin cylinder laid along Z (wheels, rollers) ???visual only */
function cylZ(
  b: Base, color: number, rough: number, metal: number,
  r: number, len: number, lx: number, ly: number, lz: number
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  mesh.rotation.z = Math.PI / 2;
  const gy = b.gy0; // rigid: prop-level ground, see box()
  mesh.position.set(lx, gy + ly, lz);
  mesh.castShadow = true;
  b.group.add(mesh);
  return mesh;
}

/** A dedicated collider box at a yaw-rotated local centre. */
function hitBox(
  b: Base,
  lx: number, ly: number, lz: number,
  hw: number, hh: number, hd: number
): void {
  const [wx, wz] = yawOf(lx, lz, b.yaw);
  const odd = Math.abs(Math.cos(b.yaw)) < 0.5;
  b.colliders.push(
    b.physics.addStaticBox(
      { x: b.cx + wx, y: b.gy0 + ly, z: b.cz + wz },
      odd ? { x: hd, y: hh, z: hw } : { x: hw, y: hh, z: hd }
    )
  );
}

// ---------------------------------------------------------------------------
// Abandoned main battle tank ???wide, low hulk: the best hard cover we have.
// Port of V5 buildTank, frozen (turret left at a random traverse).
// ---------------------------------------------------------------------------
export function placeTankHulk(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  plumes: SmokeColumns | null, cx: number, cz: number, burnt = false
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const camo = burnt ? 0x33322c : 0x4e5a42;
  const dark = burnt ? 0x1c1c1e : 0x24282c;
  const track = burnt ? 0x262422 : 0x3a3c38;

  // tracks (visual only) + road wheels
  for (const tx of [-1.15, 1.15]) {
    box(b, track, 0.9, 0.4, 0.7, 0.8, 5.4, tx, 0.05, 0, { collider: false });
    for (let i = 0; i < 5; i++) {
      cylZ(b, dark, 0.85, 0.5, 0.34, 0.74, tx, 0.32, -2 + i * 1.0);
    }
  }
  // hull + glacis + engine deck (visual)
  box(b, camo, 0.7, 0.3, 2.5, 0.85, 4.7, 0, 0.6, 0, { collider: false });
  box(b, camo, 0.7, 0.3, 2.5, 0.5, 1.2, 0, 0.5, -2.6, { collider: false, rotX: 0.5 });
  box(b, camo, 0.7, 0.3, 2.2, 0.3, 1.6, 0, 1.15, 1.5, { collider: false });
  // turret + gun frozen at a random traverse (visual only)
  const tYaw = ((rand() * 8) | 0) * (Math.PI / 4);
  const tg = new THREE.Group();
  tg.rotation.y = tYaw;
  tg.position.set(0, b.gy0 + 1.55, 0.2); // rides the prop's ground, like the hull
  const addT = (w: number, h: number, d: number, lx: number, ly: number, lz: number, color: number) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(lx, ly, lz);
    mesh.castShadow = true;
    tg.add(mesh);
  };
  addT(1.9, 0.6, 2.5, 0, 0.3, 0, camo);
  addT(1.5, 0.5, 0.8, 0, 0.25, 1.5, camo);
  const gun = new THREE.Group();
  const bm = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.85, metalness: 0.5 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 3.4, 10), bm);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -1.7;
  barrel.castShadow = true;
  gun.add(barrel);
  gun.position.set(0, 0.42, -1.1);
  tg.add(gun);
  // hatch + hull MG
  addT(0.3, 0.12, 0.3, -0.4, 0.65, 0.5, camo);
  b.group.add(tg);

  if (burnt) {
    // muzzle-black deck patch + a lazy smoke column
    box(b, 0x0d0d0e, 1, 0, 2.7, 0.02, 4.9, 0, 1.02, 0, { collider: false });
    const [px, pz] = yawOf(1.1, 1.4, b.yaw);
    plumes?.addColumn(b.cx + px, b.gy0 + 0.4, b.cz + pz, 0.55);
  }

  // ONE low hull box ???everything above (turret, gun) is soft cover
  hitBox(b, 0, 0.85, 0, 1.5, 0.85, 2.9);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Abandoned scout car — small mobile-looking cover, wrecked or clean.
// ---------------------------------------------------------------------------
export function placeScoutWreck(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const bodyC = 0x5a6348;
  const dark = 0x2a2e32;
  box(b, bodyC, 0.55, 0.35, 1.8, 0.5, 3.8, 0, 0.35, 0, { collider: false });
  box(b, bodyC, 0.55, 0.35, 1.7, 0.4, 1.1, 0, 0.75, -1.25, { collider: false });
  box(b, bodyC, 0.55, 0.35, 1.7, 0.25, 1.2, 0, 0.68, 1.25, { collider: false });
  // roll cage
  for (const [cx2, cz2] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.9], [0.8, 0.9]] as const) {
    box(b, dark, 0.5, 0.6, 0.08, 1.25, 0.08, cx2, 0.65, cz2, { collider: false });
  }
  box(b, dark, 0.5, 0.6, 1.9, 0.08, 1.5, 0, 1.3, 0.25, { collider: false });
  // four wheels (visual) ???collider stays one low center box
  for (const [wx, wz] of [[-0.85, -1.25], [0.85, -1.25], [-0.85, 1.25], [0.85, 1.25]] as const) {
    cylZ(b, 0x14161a, 0.95, 0, 0.42, 0.3, wx, 0.42, wz);
  }
  hitBox(b, 0, 0.5, 0, 1.05, 0.5, 2.2);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Crashed aircraft: snapped fuselage, planted wing, tail ???with smoke.
// ---------------------------------------------------------------------------
export function placePlaneWreck(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  plumes: SmokeColumns | null, cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const skin = 0x3d4044;
  const dark = 0x1b1d20;
  // fuselage main piece, resting on its belly
  box(b, skin, 0.8, 0.4, 0.9, 0.65, 4.6, 0, 0.3, 0.3, { collider: false });
  // broken-off nose, canted
  box(b, skin, 0.8, 0.4, 0.9, 0.5, 2.2, 0.4, 0.25, -2.9, { collider: false, rotX: 0.35 });
  // planted wing fragment
  box(b, skin, 0.8, 0.4, 5.8, 0.16, 1.2, -1.0, 0.6, 0.4, { collider: false, rotZ: 0.3 });
  // tail fin + stabiliser
  box(b, dark, 0.9, 0.5, 0.14, 1.3, 1.2, 2.2, 0.95, -0.2, { collider: false });
  box(b, dark, 0.9, 0.5, 1.6, 0.1, 0.5, 2.4, 1.3, 0.6, { collider: false, rotX: 0.3 });
  // prop disc + scattered debris
  cylZ(b, dark, 0.8, 0.5, 0.14, 1.2, 0.6, 0.5, -4.0);
  for (let i = 0; i < 6; i++) {
    const rr = 0.1 + rand() * 0.25;
    box(b, 0x2a2b2d, 1, 0.1, rr, rr * 0.5, rr, (rand() - 0.5) * 2.4, rr * 0.2, -1.6 + rand() * 4.4, { collider: false });
  }
  // ground scar + smoke at the impact point
  const [sx, sz] = yawOf(0, -2.0, b.yaw);
  plumes?.addColumn(b.cx + sx, b.gy0 + 0.2, b.cz + sz, 0.75);
  hitBox(b, 0, 0.4, 0.4, 1.0, 0.4, 2.6);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Barbed-wire fence row: wooden posts + wire strands. Posts collide; strands
// are thin visuals a bullet can pass ???reads right at night, cheap.
// ---------------------------------------------------------------------------
export function placeFenceRow(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const len = 7 + rand() * 5;
  const n = Math.max(3, Math.round(len / 2.2));
  for (let i = 0; i <= n; i++) {
    const lz = -len / 2 + (i / n) * len;
    box(b, 0x3a3226, 0.95, 0, 0.12, 1.2, 0.12, 0, 0.6, lz);
  }
  for (const h of [0.3, 0.65, 1.0]) {
    box(b, 0x555048, 0.8, 0.5, 0.03, 0.03, len, 0, h, 0, { collider: false });
  }
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Sandbag MG nest: three-quarter sandbag ring + tripod MG + ammo boxes.
// Scenery only (no operable gun), sits flush with the terrain.
// ---------------------------------------------------------------------------
export function placeMgNest(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const bagC = 0x77653f;
  const dark = 0x1c1c1e;
  const R = 1.15;
  const bags = 9;
  for (let i = 0; i < bags; i++) {
    const a = Math.PI * 0.95 + (i / (bags - 1)) * Math.PI * 1.1; // ~200° arc, open front
    const lx = Math.cos(a) * R;
    const lz = Math.sin(a) * R;
    box(b, bagC, 0.95, 0, 0.5, 0.32, 0.5, lx, 0.16, lz, { collider: false });
  }
  // tripod MG silhouette in the arc
  box(b, dark, 0.7, 0.5, 0.15, 0.18, 0.5, 0, 0.4, -0.3, { collider: false });
  box(b, dark, 0.7, 0.5, 0.08, 0.08, 0.7, 0, 0.55, -0.15, { collider: false, rotX: -0.12 });
  // ammo cans
  box(b, 0x4a5a3a, 0.8, 0.2, 0.3, 0.22, 0.4, 0, 0.14, 0.95, { collider: false });
  // low ring collider so people can't walk through the bags
  hitBox(b, 0, 0.15, 0, R * 0.9, 0.15, R * 0.9);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Abandoned cargo truck ???canvas cover or open flatbed, sometimes burnt.
// ---------------------------------------------------------------------------
export function placeTruck(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const burnt = rand() < 0.4;
  const bodyC = burnt ? 0x3d4038 : rand() < 0.5 ? 0x5c6046 : 0x55533f;
  const dark = burnt ? 0x151515 : 0x23262a;
  // chassis + cab
  box(b, dark, 0.9, 0.25, 1.0, 0.42, 4.4, 0, 0.32, 0, { collider: false });
  box(b, bodyC, 0.85, 0.3, 0.9, 0.9, 2.3, 0, 0.95, 1.05, { collider: false });
  // load bed
  box(b, bodyC, 0.85, 0.3, 2.1, 0.5, 0.1, 0, 0.85, -1.1, { collider: false });
  if (!burnt && rand() < 0.7) {
    // canvas bows + cover (a few ribs and a low tent of canvas)
    for (const [bx2, bz2] of [[0, -0.4], [0, -1.15], [0, -1.9]] as const) {
      cylZ(b, 0x2e2a26, 0.8, 0.2, 0.025, 2.2, bx2, 1.15, bz2);
    }
    const cov = new THREE.MeshStandardMaterial({ color: 0x4c5140, roughness: 0.95 });
    cov.color.offsetHSL(0, 0, (rand() - 0.5) * 0.06);
    // canvas as a stretched box with rounded look ???two pitched planes are too
    // fiddly here, so a tall box reads as a loaded tarp at night
    box(b, 0x4c5140, 0.95, 0, 1.95, 0.5, 2.6, 0, 1.3, -1.1, { collider: false });
    void cov;
  } else {
    // open bed with a few crates (or scorched remains)
    const loadC = burnt ? dark : 0x5a5a3a;
    for (let i = 0; i < 3; i++) {
      box(b, loadC, 0.9, 0.1, 0.45, 0.4, 0.45, (rand() - 0.5) * 1.2, 1.0 + rand() * 0.2, -0.8 - rand() * 0.9, { collider: false });
    }
  }
  // wheels
  for (const [wx, wz] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, 0.1], [0.95, 0.1], [-0.95, -1.3], [0.95, -1.3]] as const) {
    cylZ(b, 0x14161a, 0.95, 0, 0.44, 0.28, wx, 0.44, wz);
  }
  hitBox(b, 0, 0.55, 0, 1.05, 0.55, 2.3);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Abandoned fuel tanker ???the long cylinder silhouette reads instantly.
// ---------------------------------------------------------------------------
export function placeOilTanker(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const rust = 0x6a4630;
  const dark = 0x2a2620;
  // chassis
  box(b, dark, 0.9, 0.25, 0.9, 0.4, 4.6, 0, 0.3, 0, { collider: false });
  // cab
  box(b, rust, 0.85, 0.3, 1.0, 0.95, 1.5, 0, 0.95, 1.6, { collider: false });
  // the tank: a big horizontal cylinder (rotated into Z) + end caps
  const tankMat = new THREE.MeshStandardMaterial({ color: rust, roughness: 0.5, metalness: 0.45 });
  tankMat.color.offsetHSL(0, 0, (rand() - 0.5) * 0.05);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 3.6, 12), tankMat);
  tank.rotation.z = Math.PI / 2;
  const gy = b.terrain.heightAt(b.cx, b.cz);
  tank.position.set(0, gy + 1.0, -0.9);
  tank.castShadow = true;
  b.group.add(tank);
  // barrel ridge rings (visual only)
  for (const rz of [-1.9, -0.9, 0.1]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.06, 12), tankMat);
    ring.rotation.z = Math.PI / 2;
    ring.position.set(0, gy + 1.0, rz);
    b.group.add(ring);
  }
  // a scorch patch if burnt
  if (rand() < 0.5) {
    const scorch = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 1 }));
    scorch.rotation.z = Math.PI / 2;
    scorch.position.set(0, gy + 1.0, -0.9);
    b.group.add(scorch);
  }
  // wheels
  for (const [wx, wz] of [[-1.0, 1.9], [1.0, 1.9], [-1.0, 0.3], [1.0, 0.3], [-1.0, -1.7], [1.0, -1.7]] as const) {
    cylZ(b, 0x14161a, 0.95, 0, 0.46, 0.28, wx, 0.46, wz);
  }
  hitBox(b, 0, 0.75, -0.4, 1.1, 0.75, 2.6);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Concrete pillbox bunker ???squat dome on a low base, firing slit facing the
// player side. Solid hard cover with a distinctive skyline lump.
// ---------------------------------------------------------------------------
export function placeBunker(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const conc = 0x585d63;
  const earth = 0x33322a;
  // earth berm skirt (visual)
  box(b, earth, 1, 0, 4.4, 0.5, 4.6, 0, 0.22, 0, { collider: false });
  // base slab + half-dome
  box(b, conc, 0.95, 0.1, 3.3, 0.6, 3.5, 0, 0.5, 0, { collider: false });
  const domeMat = new THREE.MeshStandardMaterial({ color: conc, roughness: 0.92, metalness: 0.05 });
  domeMat.color.offsetHSL(0, 0, (rand() - 0.5) * 0.05);
  const gyD = b.terrain.heightAt(b.cx, b.cz);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.75, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
  dome.position.set(0, gyD + 1.1, 0);
  dome.castShadow = true;
  dome.receiveShadow = true;
  b.group.add(dome);
  // firing slit (dark notch) on the front face ???toward +Z local
  const slit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.24), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 1 }));
  slit.position.set(0, gyD + 0.95, 1.68);
  b.group.add(slit);
  // a sandbag pair hugging the front
  for (const sx of [-1.5, 1.5] as const) {
    box(b, 0x6b5c3c, 0.98, 0, 0.9, 0.4, 0.55, sx, 0.75, 1.55, { collider: false });
  }
  hitBox(b, 0, 0.95, 0, 1.7, 0.95, 1.8);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Concertina razor wire: a row of flat coil loops between wooden posts.
// ---------------------------------------------------------------------------
export function placeConcertina(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const dark = 0x2c2f33;
  const postC = 0x3a3226;
  const len = 9 + rand() * 3;
  const nPost = 6;
  // posts
  for (let i = 0; i <= nPost; i++) {
    const lz = -len / 2 + (i / nPost) * len;
    box(b, postC, 0.95, 0, 0.1, 1.15, 0.1, 0, 0.57, lz);
  }
  // two horizontal strand wires
  for (const h of [0.45, 0.95]) {
    box(b, dark, 0.7, 0.6, 0.02, 0.02, len, 0, h, 0, { collider: false });
  }
  // flat concertina coils between posts (crossed flat tori read as a roll)
  const coilMat = new THREE.MeshStandardMaterial({ color: 0x6a6f76, roughness: 0.5, metalness: 0.7 });
  const nCoil = 6;
  const gyC = b.terrain.heightAt(b.cx, b.cz);
  for (let i = 0; i < nCoil; i++) {
    const lz = -len / 2 + 0.6 + (i / (nCoil - 1)) * (len - 1.2) + (rand() - 0.5) * 0.4;
    for (const ry of [0, Math.PI / 2]) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.02, 5, 14), coilMat);
      coil.rotation.x = Math.PI / 2;
      coil.rotation.y = ry;
      coil.position.set((rand() - 0.5) * 0.1, gyC + 0.14, lz);
      b.group.add(coil);
    }
  }
  hitBox(b, 0, 0.3, 0, 0.55, 0.3, len / 2);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Anti-tank hedgehog: three crossed steel beams. Small footprint, big attitude
// ???blocks vehicles and reads instantly as "front line".
// ---------------------------------------------------------------------------
export function placeHedgehog(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const steel = 0x3a3d40;
  // two diagonal beams crossing at the top + one leaning brace
  box(b, steel, 0.55, 0.4, 0.15, 0.15, 2.7, 0, 0.45, 0, { collider: false, rotX: 0.78 });
  box(b, steel, 0.55, 0.4, 0.15, 0.15, 2.7, 0, 0.45, 0, { collider: false, rotX: -0.78, rotZ: 0.5 });
  box(b, steel, 0.55, 0.4, 0.13, 0.13, 1.9, 0, 0.4, 0, { collider: false, rotZ: -0.35 });
  // the single blocking collider (so AI and the player must walk around it)
  hitBox(b, 0, 0.55, 0, 0.75, 0.55, 0.75);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Broken wall stub: half-collapsed brickwork with jagged top and exposed rebar.
// Sits next to hamlets ???pure rubble cover.
// ---------------------------------------------------------------------------
export function placeRuinWall(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const brick = 0x6a5d4f;
  const rebar = 0x4a4438;
  // main stub, two jagged remnants of different heights
  box(b, brick, 0.92, 0.3, 3.6, 1.5, 0.45, 0, 0.4, 0, { collider: false });
  box(b, brick, 0.92, 0.3, 1.2, 0.7, 0.42, -1.3, 1.9, 0.05, { collider: false });
  box(b, brick, 0.92, 0.3, 0.9, 0.45, 0.4, 0.9, 1.9, -0.02, { collider: false });
  // exposed rebar spikes
  for (const [rx, rz] of [[-1.1, 0.06], [-0.2, -0.1], [0.7, 0.08]] as const) {
    box(b, rebar, 0.6, 0.5, 0.03, 0.34, 0.03, rx, 2.4, rz, { collider: false, rotX: (rand() - 0.5) * 0.5 });
  }
  // rubble skirt
  for (let i = 0; i < 4; i++) {
    const rr = 0.16 + rand() * 0.22;
    box(b, 0x584e42, 0.95, 0.1, rr, rr * 0.6, rr * 1.2, (rand() - 0.5) * 3.4, rr * 0.15, 0.5 + (rand() - 0.5) * 0.7, { collider: false });
  }
  hitBox(b, 0, 0.75, 0, 1.9, 0.75, 0.35);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Utility pole with crossarm, insulators and short sagging wire stubs. Pure
// silhouette bait ???reads beautifully against the night sky.
// ---------------------------------------------------------------------------
export function placeUtilityPole(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const wood = 0x4c4234;
  const dark = 0x22252a;
  // mast (tall thin box ???a cylinder would need a vertical helper)
  box(b, wood, 0.95, 0, 0.15, 5.4, 0.15, 0, 2.7, 0, { collider: false });
  // crossarm + insulator bumps
  box(b, wood, 0.95, 0, 1.7, 0.1, 0.1, 0, 4.9, 0, { collider: false });
  box(b, dark, 0.4, 0, 0.09, 0.09, 0.14, -0.55, 5.02, 0, { collider: false });
  box(b, dark, 0.4, 0, 0.09, 0.09, 0.14, 0.55, 5.02, 0, { collider: false });
  // sagging wire stubs dropping off both crossarm ends (3-segment droop)
  for (const sx of [-0.55, 0.55]) {
    let wy = 5.05;
    for (let i = 0; i < 3; i++) {
      box(b, dark, 1, 0, 0.025, 0.025, 0.62, sx + (i + 0.5) * 0.55 * (rand() < 0.5 ? 1 : 1), wy - 0.09 - i * 0.16, 0, { collider: false });
      wy -= 0.18 + i * 0.32;
    }
  }
  // thin post collider so the player brushes against it instead of ghosting
  hitBox(b, 0, 2.7, 0, 0.12, 2.7, 0.12);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Ammo dump: stacked crates + belt boxes ???a small landmark that also blocks.
// ---------------------------------------------------------------------------
export function placeAmmoDump(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const crate = 0x5a5240;
  const belt = 0x4a5a3a;
  // base layer: two crates side by side, one rotated a little
  box(b, crate, 0.9, 0.3, 1.1, 0.55, 0.6, -0.55, 0.35, 0, { collider: false });
  box(b, crate, 0.9, 0.3, 1.1, 0.55, 0.6, 0.55, 0.35, 0.05, { collider: false });
  // top crate, slightly skewed
  box(b, crate, 0.92, 0.3, 1.0, 0.5, 0.55, 0.05, 0.9, -0.03, { collider: false, rotY: 0.08 });
  // belt boxes on the ground beside
  box(b, belt, 0.85, 0.3, 0.55, 0.26, 0.35, -0.15, 0.2, 0.85, { collider: false });
  box(b, belt, 0.85, 0.3, 0.5, 0.24, 0.32, 0.75, 0.18, 0.9, { collider: false });
  hitBox(b, 0, 0.6, 0, 1.3, 0.6, 0.9);
  return { colliders: b.colliders, group: b.group };
}

// ---------------------------------------------------------------------------
// Wooden signpost: a post, an arrow plate and a small plate ???waymark filler.
// ---------------------------------------------------------------------------
export function placeSignpost(
  g: THREE.Group, physics: HulkPhysics, terrain: HulkTerrain, rand: () => number,
  cx: number, cz: number
): PropHandles {
  const b = makeBase(g, physics, terrain, rand, cx, cz);
  const wood = 0x4c4234;
  box(b, wood, 0.95, 0, 0.1, 2.1, 0.1, 0, 1.05, 0, { collider: false });
  // arrow plate canted off the travel direction
  box(b, wood, 0.9, 0, 0.85, 0.24, 0.04, 0.1, 1.65, 0, { collider: false, rotY: 0.5 + rand() * 0.6 });
  // small name plate lower down
  box(b, wood, 0.9, 0, 0.5, 0.18, 0.04, -0.08, 1.2, 0, { collider: false, rotY: -0.4 });
  hitBox(b, 0, 1.05, 0, 0.1, 1.05, 0.1);
  return { colliders: b.colliders, group: b.group };
}
