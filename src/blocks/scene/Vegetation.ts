// Ground vegetation: dry grass tufts and low scrub bushes scattered over the
// open ground. Everything is merged into TWO draw calls (one mesh for grass,
// one for bushes) and animated entirely on the GPU: a wind shader bends each
// blade by the square of its height along the stalk, so roots stay planted and
// only the tips travel. No per-object CPU work, no colliders — this layer is
// pure scenery and must never block a shot or a soldier's path.

import * as THREE from 'three';
import { Quality } from '../../world/quality';

/**
 * Per-quality budgets: [grass patches, tufts per patch, blades per tuft, bushes].
 * Grass grows in clumps rather than as an even smear — arid ground is patchy,
 * and dense clumps read at a glance while costing a fraction of the vertices.
 */
const BUDGET: Record<Quality, [number, number, number, number]> = {
  high: [80, 30, 8, 120],
  med: [48, 22, 6, 70],
  low: [18, 12, 5, 26],
};

/** A dry, dusty palette — the theatre is a parched battlefield, not a meadow. */
const ROOT_COLORS = [0x3d3a22, 0x453f26, 0x35331f];
const TIP_COLORS = [0x8a7a45, 0x9c8a4e, 0x7d6f3e, 0xa8934f];
const BUSH_COLORS = [0x2f3a22, 0x384229, 0x2a3320, 0x3f4a2c];

/**
 * Injects GPU wind into a standard material. `aSway` is 0 at the root and 1 at
 * the tip; `aPhase` carries both a per-blade random offset and a spatial term
 * so gusts visibly travel across the field instead of everything twitching in
 * unison. The bearing itself drifts slowly, so the wind never feels looped.
 */
function applyWind(material: THREE.Material, uniforms: Record<string, THREE.IUniform>) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aSway;
        attribute float aPhase;
        uniform float uTime;
        uniform float uWind;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float gust = 0.55 + 0.45 * sin(uTime * 0.75 + aPhase);
          float flutter = sin(uTime * 2.6 + aPhase * 1.7) * 0.22;
          float amp = (gust + flutter) * aSway * uWind;
          float bearing = 0.7 + sin(uTime * 0.06) * 0.5;
          transformed.x += amp * cos(bearing);
          transformed.z += amp * sin(bearing);
          transformed.y -= amp * amp * 0.4; // bending shortens the stalk
        }`
      );
  };
  material.customProgramCacheKey = () => 'vegetation-wind';
}

interface Buffer {
  pos: number[];
  norm: number[];
  col: number[];
  sway: number[];
  phase: number[];
  idx: number[];
}

function emptyBuffer(): Buffer {
  return { pos: [], norm: [], col: [], sway: [], phase: [], idx: [] };
}

export class Vegetation {
  group = new THREE.Group();

  private grass: Buffer = emptyBuffer();
  private bush: Buffer = emptyBuffer();
  private grassUniforms: Record<string, THREE.IUniform>;
  private bushUniforms: Record<string, THREE.IUniform>;
  private time = 0;
  /** Wind strength multiplier — weather can gust harder. */
  private windScale = 1;

  constructor(private rand: () => number, quality: Quality) {
    this.grassUniforms = { uTime: { value: 0 }, uWind: { value: 0.085 } };
    this.bushUniforms = { uTime: { value: 0 }, uWind: { value: 0.022 } };
    void quality; // budgets are applied by the caller via addTuft/addBush loops
  }

  /** Quality budget for the caller's scatter loops. */
  static budget(quality: Quality): [number, number, number, number] {
    return BUDGET[quality];
  }

  /**
   * A tuft of dry grass: blades fan out from a single root, each curling over
   * and tapering to a point. `segments` rows let the wind bend it as a curve
   * rather than snapping it at the base.
   */
  addTuft(x: number, y: number, z: number, scale = 1, count = 8) {
    const rnd = this.rand;
    const b = this.grass;
    const rootHex = ROOT_COLORS[(rnd() * ROOT_COLORS.length) | 0];
    const tipHex = TIP_COLORS[(rnd() * TIP_COLORS.length) | 0];
    const root = new THREE.Color(rootHex);
    const tip = new THREE.Color(tipHex);

    for (let i = 0; i < count; i++) {
      const h = (0.22 + rnd() * 0.26) * scale;
      const w = (0.022 + rnd() * 0.022) * scale;
      const curl = 0.1 + rnd() * 0.3; // how far the tip arcs over
      const face = rnd() * Math.PI * 2;
      const fx = Math.cos(face);
      const fz = Math.sin(face);
      // right = horizontal vector across the blade face
      const rx = -fz;
      const rz = fx;
      const ox = (rnd() - 0.5) * 0.12 * scale;
      const oz = (rnd() - 0.5) * 0.12 * scale;
      const lean = (rnd() - 0.5) * 0.35; // blades splay outward
      const phase = rnd() * Math.PI * 2 + x * 0.35 + z * 0.27;
      const segments = 3;
      const base = b.pos.length / 3;

      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const cy = h * t;
        const cx = fx * curl * t * t + rx * lean * t;
        const cz = fz * curl * t * t + rz * lean * t;
        const halfW = w * (1 - t) * 0.5 + 0.0015; // taper, never fully degenerate
        // normal tilts from horizontal-facing toward up as the blade curls over
        const tilt = t * curl * 1.6;
        const nx = fx * Math.cos(tilt);
        const ny = Math.sin(tilt);
        const nz = fz * Math.cos(tilt);
        const c = root.clone().lerp(tip, t);
        for (const sgn of [1, -1]) {
          b.pos.push(x + ox + cx + rx * halfW * sgn, y + cy, z + oz + cz + rz * halfW * sgn);
          b.norm.push(nx, ny, nz);
          b.col.push(c.r, c.g, c.b);
          b.sway.push(Math.pow(t, 1.35));
          b.phase.push(phase);
        }
      }
      for (let s = 0; s < segments; s++) {
        const a = base + s * 2;
        b.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }

  /** A low scrub bush: 2-3 overlapping lumps, stiff enough to only nod. */
  addBush(x: number, y: number, z: number, scale = 1) {
    const rnd = this.rand;
    const b = this.bush;
    const hex = BUSH_COLORS[(rnd() * BUSH_COLORS.length) | 0];
    const base = new THREE.Color(hex);
    const lumps = 2 + ((rnd() * 2) | 0);
    const phase = rnd() * Math.PI * 2 + x * 0.3 + z * 0.24;

    for (let l = 0; l < lumps; l++) {
      const r = (0.26 + rnd() * 0.3) * scale;
      const cy = y + r * (0.55 + rnd() * 0.35);
      const ox = (rnd() - 0.5) * 0.5 * scale;
      const oz = (rnd() - 0.5) * 0.5 * scale;
      const geo = new THREE.IcosahedronGeometry(r, 0);
      const p = geo.getAttribute('position') as THREE.BufferAttribute;
      const start = b.pos.length / 3;
      const top = cy + r;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i) + x + ox;
        const vy = p.getY(i) + cy;
        const vz = p.getZ(i) + z + oz;
        b.pos.push(vx, vy, vz);
        b.norm.push(p.getX(i) / r, p.getY(i) / r, p.getZ(i) / r);
        // higher parts of the bush are paler (sun-bleached tops)
        const shade = 0.78 + ((vy - y) / Math.max(0.001, top - y)) * 0.34;
        const c = base.clone().multiplyScalar(shade);
        b.col.push(c.r, c.g, c.b);
        // scrub is woody: it only nods, and only above its own base
        b.sway.push(Math.max(0, (vy - y) / Math.max(0.001, top - y)) * 0.4);
        b.phase.push(phase);
      }
      // IcosahedronGeometry (PolyhedronGeometry) is NON-indexed — its per-face
      // vertices are exactly the flat-shaded look we want, but there is no
      // index buffer to copy, so fall back to sequential triangles.
      const index = geo.getIndex();
      if (index) {
        for (let i = 0; i < index.count; i++) b.idx.push(start + index.getX(i));
      } else {
        for (let i = 0; i < p.count; i++) b.idx.push(start + i);
      }
      geo.dispose();
    }
  }

  /** Bake the accumulated buffers into two meshes and attach them. */
  build(): THREE.Group {
    const make = (
      buf: Buffer,
      uniforms: Record<string, THREE.IUniform>,
      opts: { flat: boolean; rough: number }
    ) => {
      if (!buf.idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.norm, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
      g.setAttribute('aSway', new THREE.Float32BufferAttribute(buf.sway, 1));
      g.setAttribute('aPhase', new THREE.Float32BufferAttribute(buf.phase, 1));
      g.setIndex(buf.idx);
      g.computeBoundingSphere();
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: opts.rough,
        metalness: 0,
        flatShading: opts.flat,
      });
      applyWind(mat, uniforms);
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = false; // thousands of blades — shadow maps stay clean
      mesh.receiveShadow = false;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      return mesh;
    };

    const grassMesh = make(this.grass, this.grassUniforms, { flat: false, rough: 0.95 });
    if (grassMesh) {
      grassMesh.name = 'grassField';
      this.group.add(grassMesh);
    }
    const bushMesh = make(this.bush, this.bushUniforms, { flat: true, rough: 1 });
    if (bushMesh) {
      bushMesh.name = 'scrubField';
      this.group.add(bushMesh);
    }
    // buffers are baked — drop the CPU-side copies
    this.grass = emptyBuffer();
    this.bush = emptyBuffer();
    return this.group;
  }

  /** Weather can call this to gust harder (rain/wind storms). */
  setWind(scale: number) {
    this.windScale = scale;
  }

  update(dt: number) {
    this.time += dt;
    this.grassUniforms.uTime.value = this.time;
    this.bushUniforms.uTime.value = this.time;
    this.grassUniforms.uWind.value = 0.085 * this.windScale;
    this.bushUniforms.uWind.value = 0.022 * this.windScale;
  }
}
