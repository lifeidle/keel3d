/**
 * Generic seeded terrain heightfield (framework scene block).
 * No sample imports — content injects size/amplitude/pockets and a texture.
 */
import * as THREE from 'three';
import { PhysicsWorld } from '../../physics/world';

export interface TerrainOpts {
  seed: number;
  size: number;
  amplitude: number;
  octaves?: number;
  pockets?: Array<{ x: number; z: number; r: number }>;
  map?: THREE.Texture | null;
  materialColor?: number;
}

export interface SeededTerrain {
  mesh: THREE.Mesh;
  heightAt: (x: number, z: number) => number;
  dispose: () => void;
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
  const seg = Math.max(32, Math.min(128, Math.floor(opts.size / 2)));

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
  mesh.name = 'seeded-terrain';

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
