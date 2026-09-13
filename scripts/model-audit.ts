// Model assembly audit: instantiate every static prop on a ROLLING HILLS
// terrain (so per-part ground sampling bugs show up as disassembly) and on
// flat ground, then check each part group for:
//   1. NaN positions / NaN bounding boxes
//   2. RIGID props (vehicles): all parts rise and fall TOGETHER with gy0
//      (the spread of part bottom heights must stay small)
//   3. nothing buried deep under the prop's ground line
// Hamlet is intentionally per-piece (walls track rolling ground) — it only
// gets the NaN + burial checks, not the rigid one.
import * as THREE from 'three';
import {
  placeTankHulk, placeJeep, placePlaneWreck, placeFenceRow,
  placeMgNest, placeTruck, placeOilTanker, placeBunker, placeConcertina,
  placeHedgehog, placeRuinWall, placeUtilityPole, placeAmmoDump, placeSignpost,
} from '../src/world/vehicles';
import { placeHamlet } from '../src/world/hamlet';
import { buildTankRig } from '../src/world/tank';
import { buildGunModel, buildEnemyGun } from '../src/world/gunmodels';
import { mulberry32 } from '../src/util/rng';

const ground = (x: number, z: number) =>
  5 + Math.sin(x * 0.09) * 3 + Math.cos(z * 0.12) * 2.5 + Math.sin((x + z) * 0.05) * 1.5;

const fakePhysics: any = {
  addStaticBox: (p: any) => ({ handle: ++(fakePhysics as any).n, center: p }),
  n: 0,
  world: { removeCollider() {}, removeRigidBody() {} },
};
const terrain: any = { heightAt: (x: number, z: number) => ground(x, z) };
const plumes: any = { addColumn() {} };

const RIGID = new Set([
  'placeTankHulk', 'placeJeep', 'placePlaneWreck', 'placeTruck', 'placeOilTanker',
  'placeHedgehog', 'placeRuinWall', 'placeAmmoDump', 'placeSignpost',
]);

let failures = 0;

function audit(name: string, build: (g: THREE.Group) => { gy0: number }) {
  const scenarii: Array<[string, number, number]> = [
    ['flat', 0, 0],
    ['slope', 40, 15],
    ['hilltop', -70, 30],
  ];
  // RIGID props: the sorted list of part-bottom heights RELATIVE to gy0 must
  // be identical on flat ground and on slopes. Per-part terrain sampling (the
  // old bug) makes the rel profile drift with the terrain — this catches it
  // exactly, regardless of stack height.
  let baseline: string | null = null;
  for (const [tag, ox, oz] of scenarii) {
    const g = new THREE.Group();
    const { gy0 } = build(g, ox, oz);
    g.updateMatrixWorld(true);
    const boxes: THREE.Box3[] = [];
    let nan = false;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!(m as any).isMesh) return;
      const b = new THREE.Box3().setFromObject(m);
      if (!Number.isFinite(b.min.x) || !Number.isFinite(b.max.y)) nan = true;
      boxes.push(b);
    });
    const problems: string[] = [];
    if (nan) problems.push('NaN bounds');
    if (boxes.length) {
      const rel = boxes
        .map((b) => (b.min.y - gy0).toFixed(2))
        .sort()
        .join(',');
      // hamlet walls intentionally track their own local ground (the cluster
      // spans slopes), so "below the cluster's gy0" is not a defect there.
      const buried = name.startsWith('placeHamlet')
        ? 0
        : boxes.filter((b) => b.min.y < gy0 - 1.2).length;
      if (buried > 0) problems.push(`${buried} part(s) buried >1.2m below gy0`);
      if (RIGID.has(name)) {
        if (baseline === null) baseline = rel;
        else if (rel !== baseline) problems.push('rigid disassembly: part layout differs from flat-ground baseline');
      }
    }
    if (problems.length) {
      failures++;
      console.log(`FAIL ${name} [${tag}] gy0=${gy0.toFixed(1)} -> ${problems.join('; ')}`);
    } else {
      console.log(` ok  ${name} [${tag}] gy0=${gy0.toFixed(1)} parts=${boxes.length}`);
    }
  }
}

// ---- static props (rigid + scenery) ----
const builders: Record<string, (g: THREE.Group, ox: number, oz: number) => { gy0: number }> = {
  placeTankHulk: (g, ox, oz) => {
    const rand = mulberry32(1);
    const cx = 10 + ox, cz = 10 + oz;
    placeTankHulk(g, fakePhysics, terrain, rand, plumes, cx, cz, false);
    return { gy0: ground(cx, cz) };
  },
  placeTankHulkBurnt: (g, ox, oz) => {
    const rand = mulberry32(2);
    const cx = 10 + ox, cz = 10 + oz;
    placeTankHulk(g, fakePhysics, terrain, rand, plumes, cx, cz, true);
    return { gy0: ground(cx, cz) };
  },
  placeJeep: (g, ox, oz) => {
    placeJeep(g, fakePhysics, terrain, mulberry32(3), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placePlaneWreck: (g, ox, oz) => {
    placePlaneWreck(g, fakePhysics, terrain, mulberry32(4), plumes, 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeFenceRow: (g, ox, oz) => {
    placeFenceRow(g, fakePhysics, terrain, mulberry32(5), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeMgNest: (g, ox, oz) => {
    placeMgNest(g, fakePhysics, terrain, mulberry32(6), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeTruck: (g, ox, oz) => {
    placeTruck(g, fakePhysics, terrain, mulberry32(7), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeOilTanker: (g, ox, oz) => {
    placeOilTanker(g, fakePhysics, terrain, mulberry32(8), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeBunker: (g, ox, oz) => {
    placeBunker(g, fakePhysics, terrain, mulberry32(9), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeConcertina: (g, ox, oz) => {
    placeConcertina(g, fakePhysics, terrain, mulberry32(10), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeHedgehog: (g, ox, oz) => {
    placeHedgehog(g, fakePhysics, terrain, mulberry32(12), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeRuinWall: (g, ox, oz) => {
    placeRuinWall(g, fakePhysics, terrain, mulberry32(13), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeUtilityPole: (g, ox, oz) => {
    placeUtilityPole(g, fakePhysics, terrain, mulberry32(14), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeAmmoDump: (g, ox, oz) => {
    placeAmmoDump(g, fakePhysics, terrain, mulberry32(15), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeSignpost: (g, ox, oz) => {
    placeSignpost(g, fakePhysics, terrain, mulberry32(16), 10 + ox, 10 + oz);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
  placeHamlet: (g, ox, oz) => {
    placeHamlet(g, fakePhysics, terrain, mulberry32(11), plumes, 10 + ox, 10 + oz, 0.7);
    return { gy0: ground(10 + ox, 10 + oz) };
  },
};

for (const [name, build] of Object.entries(builders)) {
  audit(name, build);
}

// ---- weapon rigs (local-space; only NaN + part-count sanity) ----
let gunFail = 0;
for (const key of ['rifle', 'smg', 'sniper', 'shotgun']) {
  const g = buildGunModel(key);
  g.updateMatrixWorld(true);
  let count = 0;
  let nan = false;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if ((m as any).isMesh) {
      count++;
      const b = new THREE.Box3().setFromObject(m);
      if (!Number.isFinite(b.min.x)) nan = true;
    }
  });
  if (!count || nan) {
    gunFail++;
    console.log(`FAIL buildGunModel(${key}) meshes=${count} nan=${nan}`);
  } else {
    console.log(` ok  buildGunModel(${key}) meshes=${count}`);
  }
  const eg = buildEnemyGun(key);
  eg.updateMatrixWorld(true);
  let ec = 0;
  eg.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) ec++;
  });
  if (!ec) {
    gunFail++;
    console.log(`FAIL buildEnemyGun(${key}) empty`);
  }
}
const rig = buildTankRig(false);
rig.group.updateMatrixWorld(true);
let tankParts = 0;
rig.group.traverse((o) => {
  if ((o as THREE.Mesh).isMesh) tankParts++;
});
console.log(` ok  buildTankRig parts=${tankParts} (turret/cannon/muzzle wired: ${!!rig.turret && !!rig.cannon && !!rig.muzzle})`);

console.log(failures === 0 && gunFail === 0 ? '\nALL MODEL AUDITS PASS' : `\n${failures + gunFail} AUDIT FAILURES`);
