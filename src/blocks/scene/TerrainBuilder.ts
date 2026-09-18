/**
 * Terrain heightfield builders (framework scene block).
 * Two height sources, one assembly:
 *   - `createSeededTerrain` — fbm value-noise (seeded, procedural).
 *   - `createDomeTerrain`   — data-driven Gaussian domes + deterministic
 *     ripple + flat spawn core (signature-hill arenas, à la yexi).
 * No sample imports — content injects size/height data and a texture.
 * Both return a displaced grid whose trimesh collider (when `physics` is
 * given) is the SAME surface as the visible mesh: visible ground must equal
 * physical ground (characters snap to the trimesh, props read heightAt).
 */
import * as THREE from 'three';
import { PhysicsWorld } from '../../physics/world';

export interface TerrainOpts {
  seed: number;
  size: number;
  amplitude: number;
  octaves?: number;
  pockets?: Array<{ x: number; z: number; r: number }>;
  /** Grid resolution override (default: size/2 clamped 32–128). */
  seg?: number;
  map?: THREE.Texture | null;
  materialColor?: number;
}

export interface SeededTerrain {
  mesh: THREE.Mesh;
  heightAt: (x: number, z: number) => number;
  dispose: () => void;
}

export interface DomeSpec {
  /** Centre x. */
  x: number;
  /** Centre z. */
  z: number;
  /** Peak height (units, before ripple/fade). */
  h: number;
  /** Gaussian width (units) — h·exp(−dist²/2σ²). */
  sigma: number;
}

export interface RippleSpec {
  /** Total ripple amplitude (units). */
  amp: number;
  /** x-frequency. */
  a: number;
  /** z-frequency. */
  b: number;
}

export interface DomeTerrainOpts {
  /** Gaussian hills (summed) — omitted when `heightAt` is provided. */
  domes?: DomeSpec[];
  /** Deterministic low-frequency ripple (sin composition — no external
   *  noise dependency, headless-reproducible). */
  ripple?: RippleSpec;
  /** Flat core radius — height is EXACTLY 0 inside (spawn/anchor areas). */
  flatCore?: number;
  /** Smoothstep transition width outside the flat core (0 = no fade). */
  flatRamp?: number;
  /** Bring-your-own height function (skips the dome data). */
  heightAt?: (x: number, z: number) => number;
}

export interface TerrainAssemblyOpts {
  size: number;
  seg?: number;
  map?: THREE.Texture | null;
  materialColor?: number;
  name?: string;
}

/**
 * Data-driven dome heightfield (pure — headless testable).
 * h(x,z) = Σ d.h·exp(−dist²/2σ²) + ripple, with a smoothstep fade from the
 * flat core so anchor areas (spawn, camps) stay exactly level.
 */
export function domeHeightField(opts: DomeTerrainOpts): (x: number, z: number) => number {
  const { domes = [], ripple, flatCore = 0, flatRamp = 0 } = opts;
  return (x: number, z: number): number => {
    let h = 0;
    for (const d of domes) {
      const dx = x - d.x;
      const dz = z - d.z;
      h += d.h * Math.exp(-(dx * dx + dz * dz) / (2 * d.sigma * d.sigma));
    }
    if (ripple) {
      const { amp, a, b } = ripple;
      h +=
        amp *
        0.5 *
        (Math.sin(a * x + 0.7) * Math.sin(b * z - 0.4) +
          Math.sin(b * x + 0.3) * Math.sin(a * z + 1.1));
    }
    if (flatRamp > 0) {
      const k = Math.min(1, Math.max(0, (Math.hypot(x, z) - flatCore) / flatRamp));
      return h * (k * k * (3 - 2 * k));
    }
    return h;
  };
}

/** Shared assembly: displaced grid + (optional) trimesh collider. */
function buildHeightfield(
  physics: PhysicsWorld | null,
  heightAt: (x: number, z: number) => number,
  opts: TerrainAssemblyOpts,
): SeededTerrain {
  const seg = opts.seg ?? Math.max(32, Math.min(128, Math.floor(opts.size / 2)));

  const geo = new THREE.PlaneGeometry(opts.size, opts.size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: opts.materialColor ?? 0x3a4a38,
    map: opts.map ?? undefined,
    roughness: 0.95,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = opts.name ?? 'terrain';

  if (physics && geo.index) {
    const vertices = new Float32Array(pos.array as ArrayLike<number>);
    const indices = new Uint32Array(geo.index.array as ArrayLike<number>);
    const R = physics.RAPIER;
    const body = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
    physics.world.createCollider(R.ColliderDesc.trimesh(vertices, indices), body);
  }

  return {
    mesh,
    heightAt,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const n00 = hash2(x0, z0, seed);
  const n10 = hash2(x0 + 1, z0, seed);
  const n01 = hash2(x0, z0 + 1, seed);
  const n11 = hash2(x0 + 1, z0 + 1, seed);
  const a = n00 + (n10 - n00) * sx;
  const b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sz;
}

function fbm(x: number, z: number, seed: number, octaves: number): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + o * 7919);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

export function createSeededTerrain(
  physics: PhysicsWorld | null,
  opts: TerrainOpts,
): SeededTerrain {
  const octaves = opts.octaves ?? 4;
  const heightAt = (x: number, z: number): number => {
    let h = (fbm(x * 0.045, z * 0.045, opts.seed, octaves) - 0.5) * 2 * opts.amplitude;
    if (opts.pockets) {
      for (const p of opts.pockets) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < p.r) {
          const k = 1 - d / p.r;
          h *= 1 - k * k;
        }
      }
    }
    return h;
  };
  return buildHeightfield(physics, heightAt, {
    size: opts.size,
    seg: opts.seg,
    map: opts.map,
    materialColor: opts.materialColor,
    name: 'seeded-terrain',
  });
}

/**
 * Data-driven dome terrain (signature-hill arenas).
 * `heightAt` wins over dome data (bring-your-own function); otherwise the
 * dome/ripple/flat-core data defines the field.
 */
export function createDomeTerrain(
  physics: PhysicsWorld | null,
  opts: TerrainAssemblyOpts & DomeTerrainOpts,
): SeededTerrain {
  const heightAt =
    opts.heightAt ??
    domeHeightField({
      domes: opts.domes ?? [],
      ripple: opts.ripple,
      flatCore: opts.flatCore,
      flatRamp: opts.flatRamp,
    });
  return buildHeightfield(physics, heightAt, opts);
}
