// Procedural night-map generator: seeded (reproducible via ?seed=), disposal-safe
// (clear + regenerate for a fresh random battlefield each operation).
//
// Terrain first: every prop sits on terrain.heightAt(), so nothing floats or
// sinks. The terrain owns both the render mesh and the physics trimesh.
// Wooden crates are handed to the Destructibles manager so they can be shot apart.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { CONFIG } from '../config';
import { PhysicsWorld } from '../physics/world';
import { Terrain } from './terrain';
import { DestructibleCover } from '../blocks/props/DestructibleCover';
import { FireSites } from '../blocks/fx/FireSites';
import { SmokeColumns } from '../blocks/fx/SmokeColumns';
import { placeHamlet } from '../game/nightraid/world/hamlet';
import { Vegetation } from '../blocks/scene/Vegetation';
import { pickWeather } from '../blocks/scene/Weather';
import { placeTankHulk,
  placeScoutWreck,
  placePlaneWreck,
  placeFenceRow,
  placeMgNest,
  placeTruck,
  placeOilTanker,
  placeBunker,
  placeConcertina,
  placeHedgehog,
  placeRuinWall,
  placeUtilityPole,
  placeAmmoDump,
  placeSignpost,
} from '../blocks/props/VehicleHulk';
import { opScale } from './scale';
import { QUALITY, type Quality } from './quality';
import { ClothFlags } from '../blocks/props/ClothFlags';
import { Searchlight } from '../blocks/props/Searchlight';
import { concreteTexture, sandbagTexture, scorchTexture, rutTexture } from './textures';
import { upgrade, prefetchHD, type HDName } from '../blocks/assets/PhotoTex';
import { mulberry32 } from '../util/rng';

/** Obstacle footprint shared with the minimap. */
export interface MapObstacle {
  x: number;
  z: number;
  hx: number;
  hz: number;
}
type Footprint = MapObstacle;

export interface GeneratedMap {
  group: THREE.Group;
  colliders: RAPIER.Collider[];
  spawnPoints: THREE.Vector3[]; // enemy spawn points, clear of obstacles
  obstacles: MapObstacle[]; // footprints for the tactical minimap
  terrain: Terrain;
  destructibles: DestructibleCover;
  fires: FireSites; // ambient flicker lights (cosmetic, no colliders)
  plumes: SmokeColumns; // rising smoke columns (cosmetic, no colliders)
  /** night-only glows to dim when the sun is up (windows, lanterns) */
  dayNight?: (day: boolean) => void;
  /** per-frame scenery animation (banners, searchlights— */
  dyn?: (dt: number) => void;
  /** spawn spots for the driveable player tank + enemy AI tank */
  tankSpots: { player: { x: number; z: number } | null; enemy: { x: number; z: number } | null };
  /** the enemy camp searchlight (undefined if placement failed) */
  searchlight?: Searchlight;
  /** resupply points (one-shot ammo refill via F), one per dump */
  ammoDumps: THREE.Vector3[];
  /** hostile camp centre (flag location, HUD direction cue) */
  camp: { x: number; z: number };
  /** player's base centre (green flag, spawn pocket) */
  base: { x: number; z: number };
  /** flag cloth materials —recolor the hostile one on capture */
  flagMats: { hostile: THREE.MeshStandardMaterial; friendly: THREE.MeshStandardMaterial };
  /** friendly squad spawn spots around the player's camp */
  allySpawns: THREE.Vector3[];
  seed: number;
}

/** Seed from ?seed= URL param, else a random one. */
export function seedFromURL(): number {
  const s = new URLSearchParams(location.search).get('seed');
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : (Math.random() * 1e9) | 0;
}

// Deterministic PRNG (mulberry32) imported from ../util/rng.

// night palette for structures
const M = {
  wood: 0x5e4c34,
  wood2: 0x6a5940,
  concrete: 0x4e545c,
  ruin: 0x565b62,
  wall: 0x3c434c,
  sand: 0x7a6a46,
  rock: 0x454b52,
} as const;

/** Minimal SFX surface mapgen needs (avoids importing the sample Audio class). */
export interface MapgenSfx {
  playWoodCrack: () => void;
}

export function generateMap(
  scene: THREE.Scene,
  physics: PhysicsWorld,
  audio: MapgenSfx,
  seed: number,
  quality: Quality = 'high'
): GeneratedMap {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  const colliders: RAPIER.Collider[] = [];
  const boxes: Footprint[] = [];
  const half = CONFIG.map.half; // core combat radius (bases/missions)
  const spread = CONFIG.map.contentHalf; // scenery scatter radius (open world)

  // --- dual-end deployment axis: the player's base on one side of a random
  // line through the map centre, the hostile camp diametrically opposite, so
  // the two forces spawn ~130m apart and meet in the open middle. Everything
  // below keys off these two centres. ---
  const axis = rand() * Math.PI * 2;
  const baseR = (CONFIG.map.baseRing[0] + rand() * (CONFIG.map.baseRing[1] - CONFIG.map.baseRing[0])) * half;
  const baseX = Math.cos(axis) * baseR;
  const baseZ = Math.sin(axis) * baseR;
  const campR = (CONFIG.map.campRing[0] + rand() * (CONFIG.map.campRing[1] - CONFIG.map.campRing[0])) * half;
  const campCX = -Math.cos(axis) * campR;
  const campCZ = -Math.sin(axis) * campR;

  // --- terrain (mesh + collider from one shared heightfield); a level pocket
  // at each base so flags, soldiers and cover stand on flat ground ---
  const terrain = new Terrain(seed, [
    { x: baseX, z: baseZ, r: CONFIG.terrain.flatRadius + 3 },
    { x: campCX, z: campCZ, r: 18 },
  ]);
  scene.add(terrain.buildMesh());
  terrain.buildCollider(physics);

  // --- destructible wooden cover ---
  const destructibles = new DestructibleCover(scene, physics, rand, {
    sfx: { playWoodCrack: () => audio.playWoodCrack() },
    upgradeMaterial: (m, n, r, s) => upgrade(m, n as HDName, r ?? 1, s ?? 0.85),
  });

  /**
   * Add a static box sitting ON the terrain.
   * `lift` is the box centre measured up from the ground directly beneath it.
   */
  const addBox = (
    cx: number, lift: number, cz: number,
    hx: number, hy: number, hz: number,
    color: number, rough = 0.9, tex?: THREE.Texture, hd?: HDName
  ) => {
    const gy = terrain.heightAt(cx, cz);
    const cy = gy + lift;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, map: tex });
    mat.color.offsetHSL(0, 0, (rand() - 0.5) * 0.05);
    if (hd) {
      // BoxGeometry UVs are 0..1 per face, so scale the tiling with the box's
      // own footprint —otherwise a 15m wall would stretch one tile across it.
      // Stepped in twos so the number of cached texture clones stays small.
      const rep = Math.min(24, Math.max(2, Math.round((hx + hz) * 0.45 / 2) * 2));
      upgrade(mat, hd, rep, 0.85);
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(physics.addStaticBox({ x: cx, y: cy, z: cz }, { x: hx, y: hy, z: hz }));
  };

  const overlaps = (x: number, z: number, hx: number, hz: number, pad: number = CONFIG.map.minGap) => {
    // keep both base camps clear of scattered props
    if (Math.hypot(x - baseX, z - baseZ) < CONFIG.map.spawnClear + Math.max(hx, hz)) return true;
    if (Math.hypot(x - campCX, z - campCZ) < CONFIG.map.campFootprint + Math.max(hx, hz)) return true;
    return boxes.some(
      (b) => Math.abs(x - b.x) < hx + b.hx + pad && Math.abs(z - b.z) < hz + b.hz + pad
    );
  };
  const claim = (x: number, z: number, hx: number, hz: number) =>
    boxes.push({ x, z, hx, hz });


  // --- crate clusters (1-3 stacked, each box is destroyable) ---
  for (let i = 0; i < CONFIG.map.crates; i++) {
    const x = (rand() * 2 - 1) * (spread - 6);
    const z = (rand() * 2 - 1) * (spread - 6);
    const s = 0.9 + rand() * 0.8;
    if (overlaps(x, z, s, s)) continue;
    claim(x, z, s, s);
    const stack = 1 + ((rand() * 2.2) | 0);
    const color = rand() < 0.5 ? M.wood : M.wood2;
    const gy = terrain.heightAt(x, z);
    for (let k = 0; k < stack; k++) {
      destructibles.addBox(x, z, gy, s, k * s, color);
    }
  }

  // --- lone walls (axis-aligned segments) ---
  for (let i = 0; i < CONFIG.map.walls; i++) {
    const horiz = rand() < 0.5;
    const len = 4 + rand() * 7;
    const h = 1.4 + rand() * 0.9;
    const x = (rand() * 2 - 1) * (spread - 10);
    const z = (rand() * 2 - 1) * (spread - 10);
    const hx = horiz ? len / 2 : 0.35;
    const hz = horiz ? 0.35 : len / 2;
    if (overlaps(x, z, hx, hz)) continue;
    claim(x, z, hx, hz);
    addBox(x, h / 2, z, hx, h / 2, hz, M.concrete, 0.95, concreteTexture());
  }

  // --- courtyard ruins (L/U shapes with one open side) ---
  for (let i = 0; i < CONFIG.map.compounds; i++) {
    const cx = (rand() * 2 - 1) * (spread - 16);
    const cz = (rand() * 2 - 1) * (spread - 16);
    const w = 5 + rand() * 4;
    const d = 5 + rand() * 4;
    const h = 2 + rand() * 0.8;
    const th = 0.35;
    const open = (rand() * 4) | 0; // 0 north 1 south 2 west 3 east
    const segs: Array<[number, number, number, number]> = [];
    if (open !== 0) segs.push([cx, cz - d / 2, w / 2, th / 2]);
    if (open !== 1) segs.push([cx, cz + d / 2, w / 2, th / 2]);
    if (open !== 2) segs.push([cx - w / 2, cz, th / 2, d / 2]);
    if (open !== 3) segs.push([cx + w / 2, cz, th / 2, d / 2]);
    if (segs.some((s) => overlaps(s[0], s[1], s[2], s[3], 2))) continue;
    for (const [sx, sz, hx, hz] of segs) {
      claim(sx, sz, hx, hz);
      addBox(sx, h / 2, sz, hx, h / 2, hz, M.ruin, 0.95, concreteTexture(), 'rough_concrete');
    }
  }

  // --- sandbag rings: true stacked-bag rings, one InstancedMesh draw call ---
  const ringSites: Array<{ x: number; z: number; r: number }> = [];
  for (let i = 0; i < CONFIG.map.rings; i++) {
    const x = (rand() * 2 - 1) * (spread - 8);
    const z = (rand() * 2 - 1) * (spread - 8);
    const r = 1.3 + rand() * 0.5;
    if (overlaps(x, z, r, r)) continue;
    claim(x, z, r, r);
    ringSites.push({ x, z, r });
    const gy = terrain.heightAt(x, z);
    colliders.push(
      physics.addStaticBox({ x, y: gy + 0.45, z }, { x: r * 0.85, y: 0.45, z: r * 0.85 })
    );
  }
  {
    const bagsPerRing = 13;
    const bagGeo = new THREE.BoxGeometry(0.56, 0.3, 0.24);
    const bagMat = new THREE.MeshStandardMaterial({
      color: M.sand,
      roughness: 1,
      map: sandbagTexture(),
    });
    const total = ringSites.length * bagsPerRing * 2;
    if (total > 0) {
      const inst = new THREE.InstancedMesh(bagGeo, bagMat, total);
      const P = new THREE.Vector3();
      const Q = new THREE.Quaternion();
      const S = new THREE.Vector3();
      const mx = new THREE.Matrix4();
      const C = new THREE.Color();
      const up = new THREE.Vector3(0, 1, 0);
      let idx = 0;
      for (const ring of ringSites) {
        const gy = terrain.heightAt(ring.x, ring.z);
        for (let layer = 0; layer < 2; layer++) {
          const y = gy + 0.16 + layer * 0.25; // two stacked courses
          const rad = ring.r - 0.32 + layer * 0.06; // upper course pulled in
          const off = layer === 1 ? Math.PI / bagsPerRing : 0; // stagger seams
          for (let b = 0; b < bagsPerRing; b++) {
            const a = (b / bagsPerRing) * Math.PI * 2 + off;
            P.set(
              ring.x + Math.cos(a) * rad,
              y + (Math.random() - 0.5) * 0.05,
              ring.z + Math.sin(a) * rad
            );
            Q.setFromAxisAngle(up, a); // bag long axis runs tangentially
            const sc = 0.88 + Math.random() * 0.24;
            S.set(sc, 0.8 + Math.random() * 0.35, sc);
            mx.compose(P, Q, S);
            inst.setMatrixAt(idx, mx);
            C.setHex(M.sand).offsetHSL(0, 0, (Math.random() - 0.5) * 0.14);
            inst.setColorAt(idx, C);
            idx++;
          }
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.castShadow = true;
      inst.receiveShadow = true;
      group.add(inst);
    }
  }

  // --- ambient fires: cosmetic flicker light + flame scenery (no collider) ---
  const fires = new FireSites();
  for (let i = 0; i < CONFIG.fires.count; i++) {
    const x = (rand() * 2 - 1) * (spread - 12);
    const z = (rand() * 2 - 1) * (spread - 12);
    if (overlaps(x, z, 1.7, 1.7, 0.6)) continue;
    claim(x, z, 1.7, 1.7);
    fires.addSite(x, terrain.heightAt(x, z), z, rand() < CONFIG.fires.bigChance);
  }
  group.add(fires.group);

  // --- rocks: one InstancedMesh draw call (shared geometry + material) ---
  {
    const maxRocks = CONFIG.map.rocks;
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: M.rock,
      roughness: 1,
      flatShading: true,
    });
    upgrade(rockMat, 'rock_04', 1, 0.9);
    const inst = new THREE.InstancedMesh(rockGeo, rockMat, maxRocks);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let n = 0;
    for (let i = 0; i < maxRocks; i++) {
      const x = (rand() * 2 - 1) * (spread - 6);
      const z = (rand() * 2 - 1) * (spread - 6);
      const s = 0.8 + rand() * 1.2;
      if (overlaps(x, z, s * 0.8, s * 0.8)) continue;
      claim(x, z, s * 0.8, s * 0.8);
      const gy = terrain.heightAt(x, z);
      dummy.position.set(x, gy + s * 0.55, z);
      dummy.scale.set(s, s * 0.7, s);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);
      color.set(M.rock).offsetHSL(0, 0, (rand() - 0.5) * 0.05);
      inst.setColorAt(n, color);
      colliders.push(
        physics.addStaticBox({ x, y: gy + s * 0.4, z }, { x: s * 0.7, y: s * 0.4, z: s * 0.7 })
      );
      n++;
    }
    inst.count = n;
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  // --- dead trees: dark silhouette, trunk blocks shots ---
  for (let i = 0; i < CONFIG.map.trees; i++) {
    const x = (rand() * 2 - 1) * (spread - 5);
    const z = (rand() * 2 - 1) * (spread - 5);
    if (overlaps(x, z, 0.6, 0.6, 0.4)) continue;
    claim(x, z, 0.6, 0.6);
    const gy = terrain.heightAt(x, z);
    const h = 3 + rand() * 2.4;
    const bark = new THREE.MeshStandardMaterial({ color: 0x241f18, roughness: 1, flatShading: true });
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.2, h, 6), bark);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const nb = 2 + ((rand() * 3) | 0);
    for (let b = 0; b < nb; b++) {
      const bl = 0.8 + rand() * 1.1;
      const bh = h * (0.4 + rand() * 0.5);
      const pivot = new THREE.Group();
      pivot.position.y = bh;
      pivot.rotation.y = rand() * Math.PI * 2;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.05, bl, 5), bark);
      br.position.y = bl / 2;
      br.rotation.x = -(Math.PI / 2 - (0.12 + rand() * 0.5)); // outward, slightly up
      br.castShadow = true;
      pivot.add(br);
      g.add(pivot);
    }
    g.position.set(x, gy, z);
    g.rotation.y = rand() * Math.PI;
    g.scale.set(0.9 + rand() * 0.3, 1, 0.9 + rand() * 0.3);
    group.add(g);
    colliders.push(physics.addStaticBox({ x, y: gy + h * 0.35, z }, { x: 0.18, y: h * 0.35, z: 0.18 }));
  }

  // --- burnt-out vehicle husks (solid cover with a hulking silhouette) ---
  for (let i = 0; i < CONFIG.map.wrecks; i++) {
    const x = (rand() * 2 - 1) * (spread - 12);
    const z = (rand() * 2 - 1) * (spread - 12);
    if (overlaps(x, z, 2.4, 1.8)) continue;
    claim(x, z, 2.4, 1.8);
    const gy = terrain.heightAt(x, z);
    const g = new THREE.Group();
    const rust = new THREE.MeshStandardMaterial({ color: rand() < 0.5 ? 0x4a3724 : 0x3d4130, roughness: 0.92, metalness: 0.25, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, metalness: 0.15 });
    const addWheel = (wx: number, wz: number) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.28, 10), dark);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.34, wz);
      w.castShadow = true;
      g.add(w);
    };
    // hull + torn cabin + flatbed
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 1.3), rust);
    hull.position.y = 0.62;
    hull.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.25), rust);
    cab.position.set(-0.45, 1.25, 0);
    cab.castShadow = true;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.3), dark);
    bed.position.set(0.55, 1.15, 0);
    // gutted interior: dark open cavity reads as "burnt"
    const gut = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.0), dark);
    gut.position.set(-0.45, 0.95, 0);
    g.add(hull, cab, bed, gut);
    for (const wz of [-0.75, 0.75]) {
      addWheel(-0.75, wz);
      addWheel(0.75, wz);
    }
    g.position.set(x, gy, z);
    g.rotation.y = rand() * Math.PI * 2;
    group.add(g);
    colliders.push(
      physics.addStaticBox({ x, y: gy + 0.62, z }, { x: 1.05, y: 0.62, z: 0.65 })
    );
  }

  // --- hedgehog anti-tank barricades (scenery; thin barrier collider) ---
  for (let i = 0; i < CONFIG.map.barricades; i++) {
    const x = (rand() * 2 - 1) * (spread - 8);
    const z = (rand() * 2 - 1) * (spread - 8);
    if (overlaps(x, z, 1.1, 1.1, 0.5)) continue;
    claim(x, z, 1.1, 1.1);
    const gy = terrain.heightAt(x, z);
    const steel = new THREE.MeshStandardMaterial({ color: 0x33363a, roughness: 0.55, metalness: 0.6 });
    const g = new THREE.Group();
    for (const sgn of [1, -1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.7), steel);
      beam.rotation.x = sgn * 0.85; // X-crossing pair in a vertical plane
      beam.position.y = 0.62;
      beam.castShadow = true;
      g.add(beam);
    }
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), steel);
    joint.position.y = 0.62;
    g.add(joint);
    g.position.set(x, gy, z);
    g.rotation.y = rand() * Math.PI;
    group.add(g);
    colliders.push(physics.addStaticBox({ x, y: gy + 0.62, z }, { x: 0.35, y: 0.62, z: 0.35 }));
  }

  // --- scorched shell craters (flat decals; no collider) ---
  const scorchTex = scorchTexture();
  for (let i = 0; i < CONFIG.map.craters; i++) {
    const x = (rand() * 2 - 1) * (spread - 8);
    const z = (rand() * 2 - 1) * (spread - 8);
    if (overlaps(x, z, 1.6, 1.6, 0.5)) continue;
    claim(x, z, 1.6, 1.6);
    const gy = terrain.heightAt(x, z);
    const r = 1.1 + rand() * 0.9;
    const crater = new THREE.Mesh(
      new THREE.CircleGeometry(r, 20),
      new THREE.MeshBasicMaterial({
        map: scorchTex,
        color: 0x8a7f70,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(x, gy + 0.035, z);
    crater.rotation.z = rand() * Math.PI;
    group.add(crater);
  }

  const towerLights: THREE.PointLight[] = []; // day-dimmed lamp lights
  // --- watchtower with a warm lamp (scenery + one constant light) ---
  for (let i = 0; i < CONFIG.map.towers; i++) {
    const x = (rand() * 2 - 1) * (spread - 14);
    const z = (rand() * 2 - 1) * (spread - 14);
    if (overlaps(x, z, 2.4, 2.4, 1)) continue;
    claim(x, z, 2.4, 2.4);
    const gy = terrain.heightAt(x, z);
    const h = 3.4 + rand() * 0.6;
    const wood = new THREE.MeshStandardMaterial({ color: 0x2c2a22, roughness: 0.95 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x1d1c18, roughness: 1 });
    const g = new THREE.Group();
    for (const [lx, lz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, 0.14), wood);
      leg.position.set(lx, h / 2, lz);
      leg.castShadow = true;
      g.add(leg);
    }
    const platform = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 2.1), wood);
    platform.position.y = h - 0.07;
    platform.castShadow = true;
    g.add(platform);
    // railing posts + top rail
    for (const [px, pz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), wood);
      post.position.set(px, h + 0.25, pz);
      g.add(post);
    }
    const roofCap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), roof);
    roofCap.position.y = h + 0.75;
    roofCap.rotation.y = Math.PI / 4;
    roofCap.castShadow = true;
    g.add(roofCap);
    // watch-post lamp: a small box canteen lamp (NOT a festive round lantern) —
    // dim oil-yellow, kept subtle so the camp reads as a held position at night
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0x3c3a32,
      emissive: 0xd8b878,
      emissiveIntensity: 1.1,
    });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), lampMat);
    lamp.position.y = h + 0.28;
    const lampGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 8, 6),
      new THREE.MeshBasicMaterial({
        color: 0xd8b878,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    lampGlow.position.y = h + 0.28;
    const light = new THREE.PointLight(0xd8b878, 3.5, 15, 2);
    towerLights.push(light);
    light.position.set(0, h + 0.4, 0);
    g.add(lamp, lampGlow, light);
    g.position.set(x, gy, z);
    g.rotation.y = rand() * Math.PI * 2;
    group.add(g);
  }

  // --- smoke columns: hamlets smoulder, plus a few scattered burn sites ---
  const plumes = new SmokeColumns();
  group.add(plumes.group);
  const dayHooks: Array<(day: boolean) => void> = [];
  const dynHooks: Array<(dt: number) => void> = []; // per-frame scenery anims
  /** the enemy camp searchlight (night exposure checks live in the game) */
  let searchlight: Searchlight | undefined;

  // --- ruined village clusters (outer ring skyline + sheltered cover) ---
  const hamletMinR = CONFIG.map.enemyRing[1] + 6; // outside the spawn band
  for (let i = 0; i < CONFIG.map.hamlets; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 18 && !placed; attempt++) {
      const a = rand() * Math.PI * 2;
      const r = hamletMinR + rand() * (spread - hamletMinR - 6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (overlaps(x, z, 8.5, 8.5, 4)) continue;
      claim(x, z, 8.5, 8.5);
      const yaw = ((rand() * 4) | 0) * (Math.PI / 2); // snapped: colliders are AABB
      const h = placeHamlet(group, physics, terrain, rand, plumes, x, z, yaw);
      colliders.push(...h.colliders);
      if (h.dayNight) dayHooks.push(h.dayNight);
      placed = true;
    }
  }
  // lone smoulder columns scattered in the open (distant battlefield smoke)
  for (let i = 0; i < 2; i++) {
    const a = rand() * Math.PI * 2;
    const r = 20 + rand() * (spread - 22);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (overlaps(x, z, 2, 2, 3)) continue;
    plumes.addColumn(x, terrain.heightAt(x, z) + 0.1, z, 0.5 + rand() * 0.5);
  }

  // --- abandoned armour: tanks / jeeps / plane wrecks (static cover) ---
  const vehicleSpots = (n: number, pad: number, hx: number, hz: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      for (let attempt = 0; attempt < 24 && out.length <= i; attempt++) {
        const a = rand() * Math.PI * 2;
        const r = 14 + rand() * (spread - 16);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (overlaps(x, z, hx, hz, pad)) continue;
        claim(x, z, hx, hz);
        out.push([x, z]);
      }
    }
    return out;
  };

  let emberDone = false;
  const rutMat = new THREE.MeshBasicMaterial({
    map: rutTexture(),
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  for (const [x, z] of vehicleSpots(CONFIG.map.tanks, 3, 2.2, 3.4)) {
    const burnt = rand() < 0.45;
    const h = placeTankHulk(group, physics, terrain, rand, plumes, x, z, burnt);
    colliders.push(...h.colliders);
    // the first burnt hulk still smoulders with a low ember fire
    if (burnt && !emberDone) {
      fires.addSite(x, terrain.heightAt(x, z) + 0.1, z, false);
      emberDone = true;
    }
    // twin tread marks running out from the hulk (battlefield memory)
    const gyR = terrain.heightAt(x, z);
    const ang = rand() * Math.PI;
    const len = 6 + rand() * 4;
    for (const off of [-0.8, 0.8]) {
      const g2 = new THREE.Group();
      g2.position.set(x, gyR + 0.02, z);
      g2.rotation.y = ang;
      const band = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.42), rutMat);
      band.rotation.x = -Math.PI / 2;
      band.position.set(off, 0.001, 0);
      g2.add(band);
      group.add(g2);
    }
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.planes, 3, 2.6, 3.4)) {
    const h = placePlaneWreck(group, physics, terrain, rand, plumes, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.jeeps, 2, 1.4, 2.3)) {
    const h = placeScoutWreck(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.fences, 1, 1.4, 5.5)) {
    const h = placeFenceRow(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.mgNests, 1, 1.6, 1.6)) {
    const h = placeMgNest(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.trucks, 2, 1.3, 2.4)) {
    const h = placeTruck(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.tankers, 1, 1.3, 2.7)) {
    const h = placeOilTanker(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.bunkers, 2, 2.0, 2.2)) {
    const h = placeBunker(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.concertinas, 1, 1.0, 5.5)) {
    const h = placeConcertina(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.hedgehogs, 1.5, 0.8, 0.8)) {
    const h = placeHedgehog(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.ruinWalls, 1.5, 2.0, 0.8)) {
    const h = placeRuinWall(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.poles, 0.6, 0.5, 0.5)) {
    const h = placeUtilityPole(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }
  for (const [x, z] of vehicleSpots(CONFIG.map.signposts, 0.5, 0.4, 0.4)) {
    const h = placeSignpost(group, physics, terrain, rand, x, z);
    colliders.push(...h.colliders);
  }


  // --- base camps: hostile camp + player camp sit on OPPOSITE ends of the
  // deployment axis (chosen at the top of generateMap). A flag marks each
  // camp so the two "sides" read at a glance.
  const campF = CONFIG.map.campFootprint;
  claim(campCX, campCZ, campF, campF); // keep props out of the hostile camp

  // ammo dumps: deliberate landmarks —one at the hostile camp edge, one near
  // the player's base ring (both just outside the claimed footprints). The
  // game turns these into one-shot resupply points (F to refill reserves).
  const ammoDumps: THREE.Vector3[] = [];
  {
    const ca = rand() * Math.PI * 2;
    const ax = campCX + Math.cos(ca) * (campF + 2.5);
    const az = campCZ + Math.sin(ca) * (campF + 2.5);
    placeAmmoDump(group, physics, terrain, rand, ax, az);
    ammoDumps.push(new THREE.Vector3(ax, terrain.heightAt(ax, az), az));
    const ba = rand() * Math.PI * 2;
    const bx = baseX + Math.cos(ba) * 11.5;
    const bz = baseZ + Math.sin(ba) * 11.5;
    placeAmmoDump(group, physics, terrain, rand, bx, bz);
    ammoDumps.push(new THREE.Vector3(bx, terrain.heightAt(bx, bz), bz));
  }

  // hostile squad spawns clustered around their camp (size from op scale)
  const enemyN = opScale().enemies;
  const spawnPoints: THREE.Vector3[] = [];
  const slots = Math.max(16, enemyN * 2);
  const angles = Array.from({ length: slots }, (_, i) => (i / slots) * Math.PI * 2 + rand() * 0.4);
  for (let i = angles.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [angles[i], angles[j]] = [angles[j], angles[i]];
  }
  for (const a of angles) {
    if (spawnPoints.length >= enemyN) break;
    const r = 3 + rand() * 12;
    const x = campCX + Math.cos(a) * r;
    const z = campCZ + Math.sin(a) * r;
    if (spawnPoints.some((p) => Math.hypot(p.x - x, p.z - z) < 4.5)) continue;
    spawnPoints.push(new THREE.Vector3(x, terrain.heightAt(x, z) + 0.1, z));
  }
  while (spawnPoints.length < enemyN) {
    const a = rand() * Math.PI * 2;
    const r = 3 + rand() * 12;
    const x = campCX + Math.cos(a) * r;
    const z = campCZ + Math.sin(a) * r;
    spawnPoints.push(new THREE.Vector3(x, terrain.heightAt(x, z) + 0.1, z));
  }

  // --- camp banners: animated cloth flags (hostile red / friendly green).
  // Materials stay exposed so the game can flip the hostile flag on capture.
  const banners = new ClothFlags(terrain, { x: campCX, z: campCZ }, { x: baseX, z: baseZ });
  group.add(banners.group);
  dynHooks.push((dt) => banners.update(dt));
  const hostileFlagMat = banners.mats.hostile;
  const friendlyFlagMat = banners.mats.friendly;

  // --- camp living quarters: tents near each base + a firewood pile and an
  // ammo-crate stack by the flags, so the camps read as inhabited, not staged.
  const campAxis = Math.atan2(campCZ, campCX); // direction from centre to the camp
  const makeTent = (tx: number, tz: number, yaw: number, clothC: number, darkC: number) => {
    const gy = terrain.heightAt(tx, tz);
    const cloth = new THREE.Mesh(
      new THREE.ConeGeometry(1.45, 2.1, 8, 1),
      new THREE.MeshStandardMaterial({ color: clothC, roughness: 0.95, side: THREE.DoubleSide })
    );
    cloth.position.set(tx, gy + 1.05, tz);
    cloth.rotation.y = yaw;
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    group.add(cloth);
    // two crates flanking the entrance —reads as a lived-in tent from afar
    for (const side of [-1, 1]) {
      const ex = tx + Math.cos(yaw + Math.PI / 2) * side * 0.75 + Math.cos(yaw) * 0.9;
      const ez = tz + Math.sin(yaw + Math.PI / 2) * side * 0.75 + Math.sin(yaw) * 0.9;
      const eGy = terrain.heightAt(ex, ez);
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.4), tentMat(darkC));
      crate.position.set(ex, eGy + 0.16, ez);
      crate.rotation.y = yaw;
      crate.castShadow = true;
      group.add(crate);
    }
    colliders.push(physics.addStaticBox({ x: tx, y: gy + 0.7, z: tz }, { x: 1.05, y: 0.7, z: 1.05 }));
  };
  const tentMat = (c: number) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.1 });
  // hostile camp: two tents in the rear quarter (away from the player's base)
  for (let i = 0; i < 2; i++) {
    const a = campAxis + Math.PI + (i === 0 ? -0.45 : 0.5);
    const r = 11.5 + rand() * 3.5;
    const x = campCX + Math.cos(a) * r;
    const z = campCZ + Math.sin(a) * r;
    const clash = spawnPoints.some((sp) => Math.hypot(sp.x - x, sp.z - z) < 4);
    if (clash) continue;
    makeTent(x, z, a + Math.PI / 2, rand() < 0.5 ? 0x4c4f3d : 0x55463a, 0x141310);
  }
  // player camp: one command tent just beyond the defence ring
  for (let attempt = 0; attempt < 8; attempt++) {
    const a = rand() * Math.PI * 2;
    const r = 17 + rand() * 3;
    const x = baseX + Math.cos(a) * r;
    const z = baseZ + Math.sin(a) * r;
    if (boxes.some((b) => Math.abs(x - b.x) < b.hx + 3.5 && Math.abs(z - b.z) < b.hz + 3.5)) continue;
    makeTent(x, z, rand() * Math.PI, 0x4c5540, 0x101310);
    break;
  }
  // --- enemy searchlight: a mast on the camp's forward flank that sweeps
  // the approach at night (dim at day). Lit state follows the day/night hooks.
  {
    let night = true;
    dayHooks.push((day: boolean) => {
      night = !day;
    });
    let slx = campCX;
    let slz = campCZ;
    let ok = false;
    for (let attempt = 0; attempt < 10 && !ok; attempt++) {
      const a = campAxis + (attempt % 2 === 0 ? -0.9 : 0.7) + rand() * 0.5;
      const r = 15 + rand() * 2.5;
      const x = campCX + Math.cos(a) * r;
      const z = campCZ + Math.sin(a) * r;
      if (spawnPoints.some((sp) => Math.hypot(sp.x - x, sp.z - z) < 5)) continue;
      slx = x;
      slz = z;
      ok = true;
    }
    if (ok) {
      // sweep roughly toward the player's approach (across the camp front)
      const sl = new Searchlight((xx, zz) => terrain.heightAt(xx, zz), slx, slz, campAxis + Math.PI + 0.25);
      group.add(sl.group);
      dynHooks.push((dt) => sl.update(dt, night));
      searchlight = sl;
    }
  }

  // firewood pile beside each flag (low, walkable-ish visual clutter)
  const woodPile = (px: number, pz: number) => {
    const gy = terrain.heightAt(px, pz);
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a2f1e, roughness: 1 });
    const pile = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.9 + rand() * 0.5), wood);
      log.position.set((rand() - 0.5) * 0.7, 0.08 + (i % 2) * 0.13 + rand() * 0.05, (rand() - 0.5) * 0.7);
      log.rotation.y = rand() * Math.PI;
      log.castShadow = true;
      pile.add(log);
    }
    pile.position.set(px, gy, pz);
    group.add(pile);
  };
  woodPile(campCX + 1.9, campCZ + 0.4);
  woodPile(baseX + 1.9, baseZ + 0.4);
  // ammo-crate stack by the enemy flag (a soft-cover clump)
  {
    const ax = campCX + 1.2;
    const az = campCZ - 1.3;
    const gy = terrain.heightAt(ax, az);
    for (let k = 0; k < 4; k++) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.3, 0.42),
        tentMat(0x4f5a3c)
      );
      crate.position.set(ax + (k % 2) * 0.46, gy + 0.15 + (k >> 1) * 0.31, az + ((k >> 1) % 2) * 0.46);
      crate.castShadow = true;
      group.add(crate);
    }
    colliders.push(physics.addStaticBox({ x: ax + 0.23, y: gy + 0.32, z: az + 0.23 }, { x: 0.66, y: 0.32, z: 0.66 }));
  }

  // --- player camp defence ring: a few sandbag/metal barricades just outside
  // the spawn-clear pocket so the base reads as fortified (green side). These
  // sit at radius 11-14m, outside the walkable pocket, and offer cover for
  // the opening skirmish as hostiles advance from their camp.
  const defMat = (c: number) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0.05 });
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2;
    const r = 11 + rand() * 2.5;
    const x = baseX + Math.cos(a) * r;
    const z = baseZ + Math.sin(a) * r;
    const gy = terrain.heightAt(x, z);
    const len = 3.2 + rand() * 1.2;
    const h = 1.15 + rand() * 0.25;
    const horiz = rand() < 0.5;
    // low barrier: crate line with a sandbag top row (solid, provides cover)
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? len : 0.9, h * 0.55, horiz ? 0.9 : len),
      defMat(0x4a4236)
    );
    box.position.set(x, gy + h * 0.28, z);
    box.rotation.y = rand() * Math.PI;
    box.castShadow = true;
    group.add(box);
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(horiz ? len * 0.7 : 0.8, h * 0.45, horiz ? 0.8 : len * 0.7),
      defMat(0x6a5c3c)
    );
    bag.position.set(x, gy + h * 0.7, z);
    bag.rotation.y = box.rotation.y;
    bag.castShadow = true;
    group.add(bag);
    // physical cover block (bullets stop here)
    colliders.push(
      physics.addStaticBox(
        { x, y: gy + h * 0.45, z },
        { x: horiz ? len / 2 : 0.45, y: h * 0.45, z: horiz ? 0.45 : len / 2 }
      )
    );
  }

  // friendly squad spawns in a small arc around the player's camp flag
  const allySpawns: THREE.Vector3[] = [];
  {
    const A = opScale().allies;
    const arc = rand() * Math.PI * 2;
    for (let i = 0; i < A; i++) {
      const a = arc + (i / A) * Math.PI * 2 + (rand() - 0.5) * 0.5;
      // big companies spawn on TWO rings so 24 soldiers don't stack in one
      // tight arc (spawn capsules need breathing room or physics shoves them)
      const r = A > 12 ? 2.8 + (i % 2) * 2.1 + rand() * 1.2 : 2.6 + rand() * 2.4;
      const x = baseX + Math.cos(a) * r;
      const z = baseZ + Math.sin(a) * r;
      allySpawns.push(new THREE.Vector3(x, terrain.heightAt(x, z) + 0.1, z));
    }
  }

  // --- tank spots: one driveable player tank on the FRIENDLY half (just out
  // from the base), one enemy AI tank on the hostile half —open ground with
  // a small slope so the hulks sit naturally.
  const tankSpot = (
    rMin2: number, rMax2: number,
    avoid: { x: number; z: number }[] = [],
    bias: { x: number; z: number } | null = null // keep the spot on one half
  ): { x: number; z: number } | null => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const a = rand() * Math.PI * 2;
      const r = rMin2 + rand() * (rMax2 - rMin2);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (bias && x * bias.x + z * bias.z < 0) continue; // wrong side of the map
      if (boxes.some((b) => Math.abs(x - b.x) < b.hx + 5 && Math.abs(z - b.z) < b.hz + 5)) continue;
      if (Math.hypot(x - baseX, z - baseZ) < CONFIG.map.spawnClear + 6) continue;
      if (avoid.some((p) => Math.hypot(x - p.x, z - p.z) < 26)) continue;
      const g = terrain.heightAt(x, z);
      const slope =
        Math.abs(terrain.heightAt(x + 4, z) - g) + Math.abs(terrain.heightAt(x - 4, z) - g) +
        Math.abs(terrain.heightAt(x, z + 4) - g) + Math.abs(terrain.heightAt(x, z - 4) - g);
      if (slope > 2.6) continue; // keep the hull level-ish
      return { x, z };
    }
    return null;
  };
  const axisDir = { x: Math.cos(axis), z: Math.sin(axis) }; // toward the player base
  const playerTank = tankSpot(half * 0.18, half * 0.5, [], axisDir);
  const enemyTank = playerTank
    ? tankSpot(half * 0.62, half * 0.84, [playerTank], { x: -axisDir.x, z: -axisDir.z })
    : tankSpot(half * 0.62, half * 0.84, [], { x: -axisDir.x, z: -axisDir.z });
  const tankSpots = { player: playerTank, enemy: enemyTank };

  // --- wilderness band: between the combat content and the far skyline the
  // land reads sparse but lived-in —weathered outcrops and dead trees with
  // density tapering off toward the horizon (scaled by the quality tier).
  const wildN = Math.round(26 * QUALITY[quality].worldDetail);
  const wildMat = new THREE.MeshStandardMaterial({ color: M.rock, roughness: 1, flatShading: true });
  upgrade(wildMat, 'rock_04', 1, 0.9);
  const wildBark = new THREE.MeshStandardMaterial({ color: 0x241f18, roughness: 1, flatShading: true });
  const wrMin = CONFIG.map.contentHalf + 6;
  const wrMax = CONFIG.map.terrainHalf - 40;
  let wild = 0;
  for (let i = 0; i < 900 && wild < wildN; i++) {
    const rr = wrMin + rand() * (wrMax - wrMin);
    const dens = 1 - ((rr - wrMin) / (wrMax - wrMin)) * 0.65; // thin out far away
    if (rand() > dens) continue;
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const gy = terrain.heightAt(x, z);
    if (rand() < 0.6) {
      // weathered outcrop (real collider —it can stop a bullet)
      const s = 1.6 + rand() * 3.4;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), wildMat);
      rock.position.set(x, gy + s * 0.5 - 0.7, z);
      rock.scale.y = 0.6 + rand() * 0.7;
      rock.rotation.y = rand() * Math.PI;
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
      colliders.push(
        physics.addStaticBox({ x, y: gy + s * 0.32, z }, { x: s * 0.55, y: s * 0.32, z: s * 0.55 })
      );
    } else {
      // dead tree (thin trunk collider)
      const h = 2.6 + rand() * 2.2;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, h, 6), wildBark);
      trunk.position.y = h / 2;
      g.add(trunk);
      const nb = 1 + ((rand() * 2) | 0);
      for (let b = 0; b < nb; b++) {
        const bl = 0.6 + rand() * 1;
        const pivot = new THREE.Group();
        pivot.position.y = h * (0.35 + rand() * 0.45);
        pivot.rotation.y = rand() * Math.PI * 2;
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, bl, 5), wildBark);
        br.position.y = bl / 2;
        br.rotation.x = -(Math.PI / 2 - (0.15 + rand() * 0.55));
        pivot.add(br);
        g.add(pivot);
      }
      g.position.set(x, gy - 0.1, z);
      g.rotation.y = rand() * Math.PI;
      g.scale.setScalar(0.8 + rand() * 0.4);
      group.add(g);
      colliders.push(physics.addStaticBox({ x, y: gy + h * 0.28, z }, { x: 0.14, y: h * 0.28, z: 0.14 }));
    }
    wild++;
  }

  // --- ground vegetation: dry grass tufts + low scrub, two merged meshes
  // that sway in the wind on the GPU. Scenery only —no colliders, so it can
  // never block a shot, a soldier or a vehicle. Placement skips every claimed
  // footprint (buildings, crates, roads) and any ground that slopes too hard
  // for blades to sit flush. Density tapers off toward the horizon.
  const veg = new Vegetation(rand, quality);
  const [patchN, perPatch, bladesN, bushN] = Vegetation.budget(quality);
  const vegSpread = CONFIG.map.contentHalf + 30;
  const slopeOK = (x: number, z: number) => {
    const h0 = terrain.heightAt(x, z);
    // sample a small cross: reject cliffs and boulder sides
    return (
      Math.abs(terrain.heightAt(x + 0.7, z) - h0) < 0.45 &&
      Math.abs(terrain.heightAt(x - 0.7, z) - h0) < 0.45 &&
      Math.abs(terrain.heightAt(x, z + 0.7) - h0) < 0.45 &&
      Math.abs(terrain.heightAt(x, z - 0.7) - h0) < 0.45
    );
  };
  // grass grows in PATCHES: an even smear of a few hundred tufts over a 180m
  // field is invisible, while the same tufts packed into clumps read instantly
  // (and look right —dry ground is patchy, not a lawn)
  let patches = 0;
  for (let i = 0; i < 1400 && patches < patchN; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * vegSpread; // sqrt keeps it even, not centre-heavy
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    const pr = 2.4 + rand() * 3.4; // patch radius
    if (overlaps(cx, cz, pr * 0.5, pr * 0.5, 0.2)) continue; // not inside a structure
    if (!slopeOK(cx, cz)) continue;
    const n = Math.round(perPatch * (0.6 + rand() * 0.7));
    for (let k = 0; k < n; k++) {
      const ta = rand() * Math.PI * 2;
      const tr = Math.sqrt(rand()) * pr; // even fill across the clump
      const x = cx + Math.cos(ta) * tr;
      const z = cz + Math.sin(ta) * tr;
      if (overlaps(x, z, 0.3, 0.3, 0.1)) continue;
      if (!slopeOK(x, z)) continue;
      veg.addTuft(x, terrain.heightAt(x, z) - 0.03, z, 0.75 + rand() * 0.7, bladesN - ((rand() * 3) | 0));
    }
    patches++;
  }
  let bushes = 0;
  for (let i = 0; i < 1400 && bushes < bushN; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * vegSpread;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (overlaps(x, z, 0.7, 0.7, 0.3)) continue;
    if (!slopeOK(x, z)) continue;
    veg.addBush(x, terrain.heightAt(x, z) - 0.06, z, 0.8 + rand() * 0.8);
    bushes++;
  }
  // the same seed drives the weather, so the grass can react to it: dead calm
  // in mist, a stiff bend in rain, whipping sideways in a storm
  const WIND: Record<string, number> = { clear: 0.7, mist: 0.3, rain: 1.35, storm: 2.1 };
  veg.setWind(WIND[pickWeather(seed)] ?? 0.7);
  group.add(veg.build());
  dynHooks.push((dt: number) => veg.update(dt));

  // --- far skyline band: silhouettes beyond the content radius give the
  // wall-less world depth through the fog (hills / crags / broken towers).
  // Purely visual —unlit dark meshes, no colliders, no shadows.
  const skylineMat = new THREE.MeshBasicMaterial({ color: 0x22262c });
  const skyN = Math.max(6, Math.round(14 * QUALITY[quality].worldDetail));
  for (let i = 0; i < skyN; i++) {
    const a = rand() * Math.PI * 2;
    const r = CONFIG.map.contentHalf + 102 + rand() * (CONFIG.map.terrainHalf - CONFIG.map.contentHalf - 132);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const gy = terrain.heightAt(x, z);
    const g = new THREE.Group();
    const kind = rand();
    // man-made silhouettes only —hills & crags are now REAL distant terrain
    // (the low-frequency swell), so fake natural silhouettes would break as
    // the player walks up to them
    if (kind < 0.36) {
      // broken tower slab (and sometimes a stub)
      const hh = 14 + rand() * 14;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(4 + rand() * 3, hh, 4 + rand() * 3), skylineMat);
      tower.position.y = gy + hh / 2 - 2;
      g.add(tower);
      if (rand() < 0.6) {
        const stub = new THREE.Mesh(new THREE.BoxGeometry(2.4, hh * 0.4, 2.4), skylineMat);
        stub.position.set(5 + rand() * 3, gy + hh * 0.2 - 2, 0);
        g.add(stub);
      }
    } else if (kind < 0.62) {
      // water tower: a tank on four splayed legs —classic rural skyline
      const th = 6 + rand() * 4;
      const tankR = 3 + rand() * 2;
      for (const [sx2, sz2] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]] as const) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, th, 6), skylineMat);
        leg.position.set(sx2, gy + th / 2 - 1.5, sz2);
        g.add(leg);
      }
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(tankR * 0.72, tankR, tankR * 1.6, 9), skylineMat);
      tank.position.y = gy + th + tankR * 0.4;
      g.add(tank);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(tankR * 0.72, tankR * 0.8, 8, 1), skylineMat);
      cap.position.y = gy + th + tankR * 0.4 + tankR * 0.8;
      g.add(cap);
    } else {
      // chimney or church spire —thin vertical accents
      if (rand() < 0.5) {
        const ch = 16 + rand() * 14;
        const chimney = new THREE.Mesh(new THREE.BoxGeometry(2.2, ch, 2.2), skylineMat);
        chimney.position.y = gy + ch / 2 - 1.5;
        g.add(chimney);
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.6, 2.7), skylineMat);
        mouth.position.y = gy + ch - 1.7;
        g.add(mouth);
      } else {
        const sp = 16 + rand() * 12;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(2.1, sp, 6, 1), skylineMat);
        spire.position.y = gy + sp / 2 - 1.5;
        g.add(spire);
        const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 3.4), skylineMat);
        base.position.y = gy - 0.5;
        g.add(base);
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = rand() * Math.PI;
    group.add(g);
  }

  scene.add(group);
  // artificial light dims at day: campfires -> embers, tower lamps -> off
  dayHooks.push((day: boolean) => fires.setDay(day));
  dayHooks.push((day: boolean) => {
    for (const l of towerLights) l.intensity = day ? 0.4 : 9;
  });
  const dayNight = dayHooks.length
    ? (day: boolean) => {
        for (const h of dayHooks) h(day);
      }
    : undefined;
  return {
    group, colliders, spawnPoints, obstacles: boxes, terrain, destructibles,
    fires, plumes, dayNight, tankSpots, base: { x: baseX, z: baseZ },
    ammoDumps,
    camp: { x: campCX, z: campCZ }, allySpawns, seed,
    flagMats: { hostile: hostileFlagMat, friendly: friendlyFlagMat },
    searchlight,
    dyn: dynHooks.length
      ? (dt: number) => {
          for (const h of dynHooks) h(dt);
        }
      : undefined,
  };
}

/** Remove every mesh + collider of a generated map (before regenerating). */
export function clearMap(scene: THREE.Scene, physics: PhysicsWorld, map: GeneratedMap) {
  scene.remove(map.group);
  map.group.traverse((o) => {
    // Sprites (fires / smoke plumes live INSIDE the map group) share one
    // internal geometry across the whole app — disposing it here destroys the
    // GPU buffer for every sprite still alive, which then fails WebGPU
    // validation on each submit ("Buffer used in submit while destroyed").
    // The fires/plumes systems release their per-site sprite materials in
    // their own dispose(), called right below.
    if ((o as THREE.Sprite).isSprite) return;
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = (m as unknown as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) mat.dispose();
  });
  for (const c of map.colliders) physics.world.removeCollider(c, false);
  map.terrain.dispose(scene, physics);
  map.destructibles.dispose();
  map.fires.dispose();
  map.plumes.dispose();
}
