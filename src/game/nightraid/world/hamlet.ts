// Ruined village clusters ???the skyline content layer (F package).
//
// Each cluster is a small gutted hamlet: one two-storey shell with a doorway,
// window apertures, an open shed, broken wall stubs, rubble, rooftop junk and
// a single warm door-lantern (one constant point light created at build time
// ???the pool discipline from fires.ts still holds). Window panes are emissive
// material quads ???they cost ZERO lights, so a whole cluster adds exactly one
// light.
//
// Placement rules that keep the AI honest: sites live in the OUTER band
// (radius above the enemy spawn ring) and yaw snaps to 0/90/180/270 so the
// axis-aligned physics colliders stay exactly aligned with the boxes.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { PhysicsWorld } from '../../../physics/world';
import { Terrain } from '../../../world/terrain';
import type { Plumes } from '../world/plumes';
import { upgrade } from '../world/phototex';

export interface HamletHandles {
  colliders: RAPIER.Collider[];
  /** day-night: dim window panes + lantern to near-zero during the day */
  dayNight?: (day: boolean) => void;
}

const WALL = 0x4a454c; // render-block grey (HD rough-concrete upgrades on)
const WALL_DK = 0x39353c;
const ROOF = 0x2b2624;
const WOOD = 0x57452e;
const GLASS_DAY = 0.12; // window opacity when the sun is up

// NOTE: no shared geometry cache here ???clearMap() disposes every geometry it
// finds on the map group, so a cached box would be disposed while still being
// referenced by the next map. Per-cluster box counts are small (~25), so we
// just allocate fresh geometries like the rest of mapgen does.

interface Ctx {
  g: THREE.Group; // map group (child group is added here)
  physics: PhysicsWorld;
  terrain: Terrain;
  rand: () => number;
  plumes: Plumes;
  cx: number;
  cz: number;
  yaw: number; // snapped to 0/90/180/270
}

interface Ctx {
  g: THREE.Group; // map group (child group is added here)
  physics: PhysicsWorld;
  terrain: Terrain;
  rand: () => number;
  plumes: Plumes;
  cx: number;
  cz: number;
  yaw: number; // snapped to 0/90/180/270
}

/** Rotate a local offset by a quarter-turn yaw (yaw is a multiple of π/2). */
function yawOf(x: number, z: number, yaw: number): [number, number] {
  const c = Math.round(Math.cos(yaw));
  const s = Math.round(Math.sin(yaw));
  return [x * c + z * s, -x * s + z * c];
}

/**
 * Build one ruined cluster centred at (cx,cz). Terrain-following, seeded via
 * `rand` (caller's mulberry32) so every map is reproducible.
 */
export function placeHamlet(
  g: THREE.Group,
  physics: PhysicsWorld,
  terrain: Terrain,
  rand: () => number,
  plumes: Plumes,
  cx: number,
  cz: number,
  yaw: number
): HamletHandles {
  const colliders: RAPIER.Collider[] = [];
  const windowMats: THREE.MeshBasicMaterial[] = [];
  const group = new THREE.Group();
  const lampMatRef = { m: null as THREE.MeshStandardMaterial | null };
  let lantern: THREE.PointLight | null = null;

  // NOTE: the group is positioned at (cx, 0, cz) and every child carries its
  // own terrain-sampled height, so walls track rolling ground (a single gy for
  // the whole cluster would float or sink walls on slopes).
  group.position.set(cx, 0, cz);

  /** world-space offset of local (lx,ly,lz) after yaw (y kept as-is) */
  const where = (lx: number, ly: number, lz: number): [number, number, number] => {
    const [x, z] = yawOf(lx, lz, yaw);
    return [x, ly, z];
  };

  /** terrain height at a yaw-rotated local offset */
  const groundAt = (lx: number, lz: number): number => {
    const [x, z] = yawOf(lx, lz, yaw);
    return terrain.heightAt(cx + x, cz + z);
  };

  /** axis-aligned collider half extents for a box of dims (w,h,d) */
  const halfOf = (w: number, h: number, d: number): [number, number, number] => {
    // yaw snapped to multiples of π/2: an odd quarter-turn swaps x and z
    const odd = Math.abs(Math.cos(yaw)) < 0.5;
    return odd ? [d / 2, h / 2, w / 2] : [w / 2, h / 2, d / 2];
  };

  const addBox = (
    color: number,
    w: number, h: number, d: number,
    lx: number, ly: number, lz: number, // ly = base (bottom) height above terrain
    opts: { collider?: boolean; hd?: boolean; rotY?: number } = {}
  ): THREE.Mesh => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.hd ? 0.9 : 0.96 });
    mat.color.offsetHSL(0, 0, (rand() - 0.5) * 0.05);
    if (opts.hd) upgrade(mat, 'rough_concrete', Math.max(2, Math.round(((w + d) / 3) / 2) * 2), 0.85);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    const [x, , z] = where(lx, 0, lz);
    const gy = groundAt(lx, lz);
    mesh.position.set(x, gy + ly + h / 2, z);
    // geometry is defined in local axis space; yaw turns it (and the collider
    // half extents are swapped the same way in halfOf)
    mesh.rotation.y = opts.rotY ? opts.rotY + yaw : yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (opts.collider !== false) {
      const [hx, hy, hz] = halfOf(w, h, d);
      colliders.push(
        physics.addStaticBox(
          { x: cx + x, y: gy + ly + h / 2, z: cz + z },
          { x: hx, y: hy, z: hz }
        )
      );
    }
    return mesh;
  };

  /**
   * A lit window pane glued OUTSIDE a wall face (emissive ???no light).
   * `face` is the wall's outward direction in local space (±x/±z); the pane is
   * pushed past the wall's outer surface by half its thickness (0.2m) + 0.03.
   */
  const addWindow = (
    lx: number, ly: number, lz: number,
    face: 'x' | 'z', side: 1 | -1, lit: boolean, w = 0.75, h = 1.05
  ) => {
    const mat = new THREE.MeshBasicMaterial({
      color: lit ? 0xffc48a : 0x232833,
      transparent: true,
      opacity: lit ? 0.95 : 0.5,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const off = 0.2 + 0.03; // wall half-thickness + clearance
    const [ox, , oz] = where(
      lx + (face === 'x' ? side * off : 0),
      0,
      lz + (face === 'z' ? side * off : 0)
    );
    const wy = groundAt(lx, lz) + ly + h / 2;
    quad.position.set(ox, wy, oz);
    const faceYaw =
      face === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI;
    quad.rotation.y = faceYaw + yaw;
    group.add(quad);
    if (lit) windowMats.push(mat);
  };

  // --------------------------------------------------------------- layout --
  const W = 5.2 + rand() * 1.6; // shell width (x)
  const D = 4.0 + rand() * 1.4; // shell depth (z)
  const th = 0.4; // wall thickness
  const g1 = 2.5 + rand() * 0.5; // ground floor height
  const upY = g1 + 0.08; // upper floor slab height

  // ground shell: walls on the x sides run full depth; z sides run full width.
  // One x-side keeps a doorway gap (gap faces +x or -x by yaw roll).
  const doorX = rand() < 0.5 ? -1 : 1;
  const gap = 1.6;

  // four ground walls, each as 1-2 segments so the doorway stays open
  const segs: Array<[number, number, number, number, number]> = [];
  // x=+W/2 wall: if doorX=+1 split into two; else solid
  if (doorX === 1) {
    const s = (D - gap) / 2;
    segs.push([W / 2, th, g1, -D / 2 + s / 2, s]);
    segs.push([W / 2, th, g1, gap / 2 + s / 2, s]);
  } else {
    segs.push([W / 2, th, g1, 0, D]);
  }
  // x=-W/2 wall: solid unless doorX=-1
  if (doorX === -1) {
    const s = (D - gap) / 2;
    segs.push([-W / 2, th, g1, -D / 2 + s / 2, s]);
    segs.push([-W / 2, th, g1, gap / 2 + s / 2, s]);
  } else {
    segs.push([-W / 2, th, g1, 0, D]);
  }
  // z walls solid
  segs.push([0, W, g1, -D / 2, th]);
  segs.push([0, W, g1, D / 2, th]);

  for (const [wx, ww, wh, wz, wd] of segs) addBox(WALL, ww, wh, wd, wx, 0, wz, { hd: true });

  // upper storey: partial floor slab + remnant walls + broken parapets.
  // The slab HAS a collider: it blocks bullets/vision like a real floor, and
  // sits high enough (g1+0.1 ???2.6-3.1m) that nobody can jump onto it.
  const upW = W * 0.55;
  const upD = D * 0.55;
  addBox(ROOF, upW, 0.16, upD, 0, upY, 0, { hd: false });
  const rems = 1 + ((rand() * 2) | 0);
  for (let r = 0; r < rems; r++) {
    const h = 0.7 + rand() * 1.1;
    if (rand() < 0.5) {
      const len = upW * (0.45 + rand() * 0.5);
      const off = (rand() * 2 - 1) * upD * 0.28;
      addBox(WALL_DK, len, h, 0.2, rand() < 0.5 ? -upW / 2 : upW / 2, upY + 0.16, off, { collider: false });
    } else {
      const len = upD * (0.45 + rand() * 0.5);
      const off = (rand() * 2 - 1) * upW * 0.28;
      addBox(WALL_DK, 0.2, h, len, off, upY + 0.16, rand() < 0.5 ? -upD / 2 : upD / 2, { collider: false });
    }
  }
  // chimney + rooftop junk
  addBox(WALL_DK, 0.5, 0.8 + rand() * 0.5, 0.5, -upW * 0.25, upY + 0.16, -upD * 0.25, { collider: false });
  if (rand() < 0.65) {
    const jh = 0.5 + rand() * 0.9;
    addBox(WALL_DK, 0.8 + rand() * 0.6, jh, 0.6 + rand() * 0.4, upW * 0.2, upY + 0.16, upD * 0.15, { collider: false });
  }

  // ground-floor windows: on the solid z walls (+ the closed x wall)
  const sill = 0.9 + rand() * 0.2; // pane bottom above ground
  const nWin = 2 + ((rand() * 2) | 0);
  const stride = (w: number) => {
    const arr: number[] = [];
    const s = (w - 1.6) / Math.max(1, nWin - 1);
    for (let i = 0; i < nWin; i++) arr.push(-w / 2 + 0.8 + i * s + (rand() - 0.5) * 0.3);
    return arr;
  };
  // +z wall face: quads outside z=D/2, spread along x, facing +z
  for (const ax of stride(W)) addWindow(ax, sill, D / 2, 'z', 1, rand() < 0.45);
  // -z wall face: quads outside z=-D/2, facing -z
  for (const ax of stride(W)) addWindow(ax, sill, -D / 2, 'z', -1, rand() < 0.45);
  // the closed x wall (door side stays dark and blank)
  if (doorX === -1) {
    // door on -x ???+x wall closed: quads at x=W/2 facing +x
    for (const az of stride(D)) addWindow(W / 2, sill, az, 'x', 1, rand() < 0.45);
  } else {
    for (const az of stride(D)) addWindow(-W / 2, sill, az, 'x', -1, rand() < 0.45);
  }

  // ---------------------------------------------------------------- annex --
  const shW = 2.4 + rand() * 1.1;
  const shD = 2.2 + rand() * 0.9;
  const shH = 1.9 + rand() * 0.5;
  // shed leans on the shell's open door side, offset out
  const doorSide = doorX === 1 ? W / 2 : -W / 2;
  const shSgn = doorX;
  const shedCX = doorSide + shSgn * (shW / 2 + 0.4);
  const shedCZ = (rand() * 2 - 1) * 0.6;
  // three walls + open front facing the shell doorway
  addBox(WOOD, shW, shH, 0.16, shedCX, 0, shedCZ - shD / 2);
  addBox(WOOD, shW, shH, 0.16, shedCX, 0, shedCZ + shD / 2);
  addBox(WOOD, 0.16, shH, shD, shedCX + shSgn * shW / 2, 0, shedCZ);
  // corrugated-ish roof with overhang
  addBox(ROOF, shW + 0.3, 0.14, shD + 0.3, shedCX, shH + 0.08, shedCZ, { collider: false });
  // shed window on the outer wall
  addWindow(shedCX + shSgn * (shW / 2), shH * 0.55, shedCZ, 'x', shSgn, rand() < 0.5, 0.55, 0.7);

  // ---------------------------------------------------- rubble + stub wall --
  const rubN = 5 + ((rand() * 5) | 0);
  for (let i = 0; i < rubN; i++) {
    const rr = 0.2 + rand() * 0.55;
    const rx = (rand() * 2 - 1) * (W * 0.6 + 0.6);
    const rz = (rand() * 2 - 1) * (D * 0.6 + 0.6);
    if (Math.abs(rx) < W / 2 - 0.3 && Math.abs(rz) < D / 2 - 0.3) continue; // keep the yard clear
    addBox(WALL_DK, rr, rr * (0.5 + rand() * 0.4), rr * 0.8, rx, rr * 0.25, rz, { collider: false });
  }
  if (rand() < 0.7) {
    const stbL = 1.8 + rand() * 1.8;
    const stbH = 1.1 + rand() * 1.4;
    const stubX = doorX === 1 ? W / 2 : -W / 2;
    const stubZ = doorX === 1 ? D / 2 + 1 : -D / 2 - 1;
    addBox(WALL_DK, th, stbH, stbL, stubX, 0, stubZ, { hd: true });
  }

  // --------------------------------------------------------------- lantern --
  const lx = 0;
  const lz = doorX === 1 ? D / 2 - 0.5 : -D / 2 + 0.5;
  // military canteen lamp: a small boxy oil lamp, dim and utilitarian ???NOT a
  // festive round lantern. Cold night, one weak survivor light.
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0x3c3a32,
    emissive: 0xd8b878,
    emissiveIntensity: 1.0,
  });
  lampMatRef.m = lampMat;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.14), lampMat);
  const [lwx, , lwz] = where(lx, 0, lz);
  const lwy = groundAt(lx, lz) + g1 * 0.55;
  lamp.position.set(lwx, lwy, lwz);
  lamp.castShadow = false;
  group.add(lamp);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0xd8b878,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.position.copy(lamp.position);
  group.add(glow);
  lantern = new THREE.PointLight(0xd8b878, 3.5, 12, 2);
  lantern.position.copy(lamp.position);
  group.add(lantern);

  // one smoke column per hamlet ???a burning patch behind the shed
  const [sx, , sz] = where(0, 0, -D / 2 - 1.6);
  const sy = groundAt(0, -D / 2 - 1.6);
  plumes.addColumn(cx + sx, sy + 0.3, cz + sz, 0.6);

  g.add(group);
  const gl = glow;
  return {
    colliders,
    dayNight: (day: boolean) => {
      for (const m of windowMats) {
        m.color.setHex(day ? 0x2c333d : 0xffc48a);
        m.opacity = day ? GLASS_DAY : 0.95;
      }
      if (lantern) lantern.intensity = day ? 0 : 3.5;
      lampMat.emissiveIntensity = day ? 0.03 : 2.2;
      (gl.material as THREE.MeshBasicMaterial).opacity = day ? 0 : 0.26;
    },
  };
}
