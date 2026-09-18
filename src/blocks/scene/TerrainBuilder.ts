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

export interface ShadeFieldOpts {
  /** Pixel buffer size (px, square). */
  size: number;
  /** World half-extent (units) — canvas up = world −z, right = +x (north-fixed). */
  extent: number;
  heightAt: (x: number, z: number) => number;
  /** Normalization height (default: max sampled height). */
  maxH?: number;
  /** RGB colour at h = 0. */
  low?: [number, number, number];
  /** RGB colour at h = maxH. */
  high?: [number, number, number];
  /** Slope darkening factor (0 = off). */
  slope?: number;
  /** Pixel alpha (0–255). */
  alpha?: number;
}

/**
 * Heightfield → RGBA pixel buffer (row-major, size×size). PURE — headless
 * testable (no canvas/DOM). North-fixed mapping (canvas up = world −z,
 * right = +x — same as yexi's minimap worldToMap). Colour lerps low→high by
 * h/maxH, then a simple hillshade darkens south-facing shadow (down-slope).
 */
export function shadeHeightfield(opts: ShadeFieldOpts): Uint8ClampedArray {
  const {
    size,
    extent,
    heightAt,
    low = [10, 14, 20],
    high = [96, 128, 160],
    slope = 0.6,
    alpha = 255,
  } = opts;
  const hs = new Float32Array(size * size);
  let maxH = opts.maxH ?? 0;
  for (let py = 0; py < size; py++) {
    const z = (((py + 0.5) / size) * 2 - 1) * extent;
    for (let px = 0; px < size; px++) {
      const x = (((px + 0.5) / size) * 2 - 1) * extent;
      const h = heightAt(x, z);
      hs[py * size + px] = h;
      if (h > maxH) maxH = h;
    }
  }
  if (maxH <= 0) maxH = 1;
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const t = Math.max(0, Math.min(1, hs[i] / maxH));
    let shade = 1;
    if (slope > 0 && i + size < size * size) {
      // dh toward canvas +y (world +z = south); rising south = shadowed face
      const dh = (hs[i + size] - hs[i]) / maxH;
      shade = Math.min(1.25, Math.max(0.25, 1 - dh * slope));
    }
    const o = i * 4;
    out[o] = (low[0] + (high[0] - low[0]) * t) * shade;
    out[o + 1] = (low[1] + (high[1] - low[1]) * t) * shade;
    out[o + 2] = (low[2] + (high[2] - low[2]) * t) * shade;
    out[o + 3] = alpha;
  }
  return out;
}

/**
 * DOM wrapper: heightfield → offscreen canvas (e.g. a minimap terrain
 * layer to drawImage over a background). Requires `document` — the pure
 * core is {@link shadeHeightfield}.
 */
export function terrainShadeCanvas(opts: ShadeFieldOpts): HTMLCanvasElement {
  const { size } = opts;
  const buf = shadeHeightfield(opts);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = new ImageData(size, size);
    imgData.data.set(buf);
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
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
