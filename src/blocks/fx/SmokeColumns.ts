// Rising smoke columns (battlefield smoulder / distant fires). Purely
// cosmetic scenery — no lights, no colliders — following the same discipline
// as fires.ts: geometry created once at map build, animated in place.
//
// A column is a stack of soft smoke puffs that endlessly rise, expand and
// fade; phases are staggered so the column reads as one continuous plume.
import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';

const PUFFS_PER_COL = 7;

interface Puff {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  phase: number; // 0..1 position along the column's lifetime
  speed: number; // cycles per second (each cycle = one full rise)
  drift: number; // horizontal drift, m/s
  baseY: number;
  height: number; // rise distance
  baseScale: number;
}

interface Column {
  puffs: Puff[];
  t: number;
}

let _smokeTex: THREE.Texture | null = null;

/** Soft grey radial puff — bright core to transparent rim. */
function smokeTexture(): THREE.Texture {
  if (_smokeTex) return _smokeTex;
  if (!HAS_DOM) {
    return (_smokeTex = new THREE.DataTexture(new Uint8Array([120, 120, 125, 255]), 1, 1, THREE.RGBAFormat));
  }
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(150,152,158,0.55)');
  g.addColorStop(0.45, 'rgba(120,122,128,0.3)');
  g.addColorStop(1, 'rgba(100,102,108,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (_smokeTex = t);
}

export class SmokeColumns {
  group = new THREE.Group();
  private cols: Column[] = [];

  /**
   * Start one smoke column at (x, y, z). `strength` scales puff size + speed
   * (0.4 faint ember .. 1.2 heavy blaze).
   */
  addColumn(x: number, y: number, z: number, strength = 1): void {
    const puffs: Puff[] = [];
    const driftDir = Math.random() * Math.PI * 2;
    for (let i = 0; i < PUFFS_PER_COL; i++) {
      const mat = new THREE.SpriteMaterial({
        map: smokeTexture(),
        color: 0x9a9ca2,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, y, z);
      sprite.scale.setScalar(0.8);
      this.group.add(sprite);
      puffs.push({
        sprite,
        mat,
        phase: i / PUFFS_PER_COL,
        speed: (0.09 + Math.random() * 0.07) * strength,
        drift: Math.random() * 0.5,
        baseY: y,
        height: (5 + Math.random() * 4) * strength,
        baseScale: (1.1 + Math.random() * 0.8) * strength,
      });
      // spread the initial puff positions along the column
      const k = i / PUFFS_PER_COL;
      sprite.position.y = y + k * puffs[0].height;
      void driftDir;
    }
    // tweak each puff's drift direction for a natural sway
    for (const p of puffs) p.drift = driftDir;
    this.cols.push({ puffs, t: Math.random() * 10 });
  }

  /** Per-frame: advance every puff along its rise/fade cycle. */
  update(dt: number) {
    const wind = Math.sin(performance.now() / 9000) * 0.12;
    for (const col of this.cols) {
      col.t += dt;
      for (const p of col.puffs) {
        p.phase += p.speed * dt;
        if (p.phase >= 1) p.phase -= 1;
        // ease: slow near the ground, fastest mid-rise, then widen & fade
        const k = p.phase;
        const h = k * p.height;
        p.sprite.position.y = p.baseY + h;
        p.sprite.position.x += (wind + Math.cos(col.t * 0.7 + p.phase * 9)) * 0.02 * dt * 60;
        const s = p.baseScale * (0.7 + k * 1.6);
        p.sprite.scale.set(s, s, 1);
        // opacity envelope: fade in at the base, peak mid, fade at the top
        const env = Math.sin(k * Math.PI);
        p.mat.opacity = env * 0.34;
      }
    }
  }

  /** Remove all puffs (map regenerate). Shared texture stays alive. */
  dispose() {
    for (const col of this.cols) {
      for (const p of col.puffs) {
        p.mat.dispose();
        this.group.remove(p.sprite);
      }
    }
    this.cols = [];
  }
}
