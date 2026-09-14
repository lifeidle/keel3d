// Seeded rolling terrain for the night arena.
//
// One height function drives three consumers so they can never drift apart:
//   1. the render mesh (displaced grid + vertex colours)
//   2. the physics trimesh collider —built from the SAME vertex/index buffers
//   3. prop / spawn placement via heightAt() sampling
//
// Trimesh (not Rapier's heightfield) keeps the vertex layout under our control;
// heightfield would require guessing the engine's column-major matrix order.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { CONFIG } from '../config';
import { PhysicsWorld } from '../physics/world';
import { groundTexture } from './textures';
import { upgrade } from '../blocks/assets/PhotoTex';

/** Deterministic 2D hash -> [0,1). */
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
  const sx = fx * fx * (3 - 2 * fx); // smoothstep
  const sz = fz * fz * (3 - 2 * fz);
  const n00 = hash2(x0, z0, seed);
  const n10 = hash2(x0 + 1, z0, seed);
  const n01 = hash2(x0, z0 + 1, seed);
  const n11 = hash2(x0 + 1, z0 + 1, seed);
  const a = n00 + (n10 - n00) * sx;
  const b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sz;
}

/** Fractal (multi-octave) value noise in 0..1. */
function fbm(x: number, z: number, seed: number): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < CONFIG.terrain.octaves; o++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + o * 7919);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

/** A level pocket on the terrain (a base camp, etc.). */
export interface FlatPocket {
  x: number;
  z: number;
  r: number; // level radius —noise eases out to zero at the centre
}

export class Terrain {
  readonly size: number; // square world extent (arena + margin)
  readonly seg: number; // grid cells per side
  private grid: Float32Array; // (seg+1)^2 heights, row-major by z
  private positions: Float32Array;
  private colors: Float32Array;
  private uvs: Float32Array;
  private indices: Uint32Array;
  private mesh: THREE.Mesh | null = null;
  private collider: RAPIER.Collider | null = null;
  private flats: FlatPocket[];

  constructor(
    private seed: number,
    flats: FlatPocket[] = [{ x: 0, z: 0, r: CONFIG.terrain.flatRadius }]
  ) {
    this.flats = flats;
    const t = CONFIG.terrain;
    this.seg = t.segments;
    // the terrain is a single seamless sheet far larger than the combat
    // arena —no walls, no basin rim; the world just continues (fog + the
    // skyline band hide the true extent)
    this.size = CONFIG.map.terrainHalf * 2;

    const n = this.seg + 1;
    this.grid = new Float32Array(n * n);
    this.positions = new Float32Array(n * n * 3);
    this.colors = new Float32Array(n * n * 3);
    this.uvs = new Float32Array(n * n * 2);
    const idx = new Uint32Array(this.seg * this.seg * 6);

    // --- heights + vertex buffers (single source of truth) ---
    const base = new THREE.Color(CONFIG.colors.ground);
    const c = new THREE.Color();
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        const x = this.axis(ix);
        const z = this.axis(iz);
        const h = this.rawHeight(x, z);
        this.grid[i] = h;
        this.positions[i * 3] = x;
        this.positions[i * 3 + 1] = h;
        this.positions[i * 3 + 2] = z;

        // ridges catch the moonlight, hollows stay black
        const k = THREE.MathUtils.clamp(h / (t.amplitude || 1), -1, 1);
        c.copy(base).offsetHSL(0, 0, k * 0.055 + (hash2(ix, iz, seed + 31) - 0.5) * 0.03);
        this.colors[i * 3] = c.r;
        this.colors[i * 3 + 1] = c.g;
        this.colors[i * 3 + 2] = c.b;

        // normalised 0..1 UVs so material.repeat controls the world tiling
        this.uvs[i * 2] = ix / this.seg;
        this.uvs[i * 2 + 1] = iz / this.seg;
      }
    }

    // --- triangles ---
    let p = 0;
    for (let iz = 0; iz < this.seg; iz++) {
      for (let ix = 0; ix < this.seg; ix++) {
        const a = iz * n + ix;
        const b = a + 1;
        const cnr = a + n;
        const d = cnr + 1;
        idx[p++] = a; idx[p++] = cnr; idx[p++] = b;
        idx[p++] = b; idx[p++] = cnr; idx[p++] = d;
      }
    }
    this.indices = idx;
  }

  /** World coordinate of grid line i along one axis (centred on origin). */
  private axis(i: number): number {
    return -this.size / 2 + (i / this.seg) * this.size;
  }

  /** Unsampled height function: fractal noise + level base pockets + rim rise. */
  private rawHeight(x: number, z: number): number {
    const t = CONFIG.terrain;
    const n = fbm((x + 1000) * t.noiseScale, (z + 1000) * t.noiseScale, this.seed);
    // distant rolling terrain: one very-low-frequency swell so far-off ground
    // reads as real hills —with no walls the hills ARE the horizon, at any
    // distance, and never "break" when approached
    const swell = valueNoise((x + 700) * 0.0038, (z + 700) * 0.0038, this.seed ^ 0x5f3567);
    let h = (n - 0.5) * 2 * t.amplitude + (swell - 0.5) * 9;
    // level pockets at each base: nearest flat wins, noise eases out to zero
    let ease = 1;
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r) {
        const k = d / f.r;
        ease = Math.min(ease, k * k);
      }
    }
    h *= ease;
    return h;
  }

  /** Bilinear sample of the generated grid —authoritative for placement. */
  heightAt(x: number, z: number): number {
    const n = this.seg + 1;
    const fx = ((x + this.size / 2) / this.size) * this.seg;
    const fz = ((z + this.size / 2) / this.size) * this.seg;
    const ix = THREE.MathUtils.clamp(Math.floor(fx), 0, n - 2);
    const iz = THREE.MathUtils.clamp(Math.floor(fz), 0, n - 2);
    const tx = THREE.MathUtils.clamp(fx - ix, 0, 1);
    const tz = THREE.MathUtils.clamp(fz - iz, 0, 1);
    const h00 = this.grid[iz * n + ix];
    const h10 = this.grid[iz * n + ix + 1];
    const h01 = this.grid[(iz + 1) * n + ix];
    const h11 = this.grid[(iz + 1) * n + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  /** Render mesh (built lazily from the shared buffers). */
  buildMesh(): THREE.Mesh {
    if (this.mesh) return this.mesh;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(this.indices, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: groundTexture(),
      roughness: 0.96,
      metalness: 0,
      flatShading: false,
    });
    // HD sand photo set replaces the procedural speckle once it decodes;
    // until then the canvas dirt keeps the ground textured (no black flash).
    // Repeat tracks the sheet size so tile spacing stays ~3.8m on any map.
    upgrade(mat, 'sand_01', Math.max(64, Math.round(this.size / 3.8)), 0.7);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    return this.mesh;
  }

  /** Static trimesh collider from the same buffers —visual == collision. */
  buildCollider(physics: PhysicsWorld): RAPIER.Collider {
    if (this.collider) return this.collider;
    const desc = RAPIER.ColliderDesc.trimesh(this.positions, this.indices)
      .setFriction(0.9)
      .setRestitution(0);
    this.collider = physics.world.createCollider(desc);
    return this.collider;
  }

  /** Remove mesh + collider (called when a new operation regenerates the map). */
  dispose(scene: THREE.Scene, physics: PhysicsWorld) {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (this.collider) {
      physics.world.removeCollider(this.collider, false);
      this.collider = null;
    }
  }
}
