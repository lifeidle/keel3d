// Weather: seeded per-operation atmosphere. Varies the scene fog (how far you
// can see) and, for rain/storm, spawns a camera-locked rain field with wind
// drift. Deterministic from the map seed so ?seed= reproduces the same sky.
import * as THREE from 'three';
import { CONFIG } from '../../../config';
import { QUALITY, type Quality } from '../../../world/quality';
import { mulberry32 } from '../../../util/rng';

export type WeatherKind = 'clear' | 'mist' | 'rain' | 'storm';

const KINDS: WeatherKind[] = ['clear', 'mist', 'rain', 'storm'];

// Deterministic PRNG (mulberry32) imported from ../util/rng.

/** Weighted draw: clear 40% / mist 30% / rain 22% / storm 8%. */
export function pickWeather(seed: number): WeatherKind {
  const r = mulberry32(seed ^ 0x9e3779b9)();
  if (r < 0.4) return 'clear';
  if (r < 0.7) return 'mist';
  if (r < 0.92) return 'rain';
  return 'storm';
}

// fog near/far per kind (linear Fog — same type the engine already uses).
// dayMix = how much of the bright daytime sky shows through this weather
// (clear reads blue, storm reads overcast grey) for the day palette.
const FOG: Record<WeatherKind, { near: number; far: number; bg: number; dayMix: number }> = {
  clear: { near: 70, far: 300, bg: 0x0a0e16, dayMix: 0.94 },
  mist: { near: 36, far: 165, bg: 0x0c1019, dayMix: 0.78 },
  rain: { near: 28, far: 130, bg: 0x0a0d14, dayMix: 0.5 },
  storm: { near: 16, far: 85, bg: 0x070a10, dayMix: 0.34 },
};

/** Night moods for the moonlight, rolled from the map seed so ?seed= is stable.
 *  Tinted through the engine's moon DirectionalLight (color + intensity). */
export function moonForSeed(seed: number): { color: number; intensity: number } {
  const MOONS: Array<{ color: number; intensity: number }> = [
    { color: 0xbfd4ff, intensity: 0.55 }, // default crisp cold night
    { color: 0xd9e3ff, intensity: 0.8 }, // bright full moon
    { color: 0x9fb0d8, intensity: 0.42 }, // thin, dim crescent
    { color: 0xc8bdff, intensity: 0.62 }, // violet-tinted night
  ];
  return MOONS[Math.abs(seed | 0) % MOONS.length];
}

interface BoltLine {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  life: number;
  peak: number;
}

export class Weather {
  readonly kind: WeatherKind;
  /** fog reach multiplier from the quality tier (low/med pull fog closer). */
  private fogMul = 1;
  /** Base fog + bg for this kind, scaled by the quality tier; the day/night
   *  palette applies its own multiplier on top when recomposing the scene. */
  get fogBase(): { near: number; far: number; bg: number; dayMix: number } {
    const f = FOG[this.kind];
    return { near: f.near * this.fogMul, far: f.far * this.fogMul, bg: f.bg, dayMix: f.dayMix };
  }
  /** Live quality change — rescale the fog reach immediately. */
  setFogMul(mul: number) {
    this.fogMul = mul;
    const f = FOG[this.kind];
    const fog = this.scene.fog as THREE.Fog;
    fog.near = f.near * mul;
    fog.far = f.far * mul;
  }
  private scene: THREE.Scene;
  private quality: Quality;
  private wind = new THREE.Vector3();
  private rain: THREE.Points | null = null;
  private size = 130; // horizontal half-extent of the rain box around player
  private height = 75; // vertical extent of the rain field

  // storm lightning: one self-owned directional light (constant count), bolt
  // line scenery, and a random strike scheduler
  private boltLight: THREE.DirectionalLight | null = null;
  private boltTarget: THREE.Object3D | null = null;
  private bolts: BoltLine[] = [];
  private nextStrike = 2; // seconds until the first strike
  private strikeNow = 0; // flash envelope 0..1, decays fast after a strike

  constructor(scene: THREE.Scene, seed: number, quality: Quality = 'high') {
    this.scene = scene;
    this.quality = quality;
    this.fogMul = QUALITY[quality].fogFarMul;
    // ?w=clear|mist|rain|storm overrides the seeded roll (handy for tuning)
    this.kind = (() => {
      try {
        const w = new URLSearchParams(location.search).get('w');
        if (w === 'clear' || w === 'mist' || w === 'rain' || w === 'storm') return w;
      } catch {
        /* non-browser (tests) — ignore */
      }
      return pickWeather(seed);
    })();

    // wind: a steady slant that pushes rain + (later) debris feel
    const wr = mulberry32(seed ^ 0xc2b2ae35)();
    const wz = mulberry32(seed ^ 0x85ebca6b)();
    const mag = this.kind === 'storm' ? 7 : this.kind === 'rain' ? 3 : 1.2;
    this.wind.set((wr * 2 - 1) * mag, 0, (wz * 2 - 1) * mag);

    // fog + sky tint (night baseline; applyDayNight re-composes these for the
    // selected time-of-day right after construction) — scaled by quality tier
    const f = FOG[this.kind];
    const fog = this.scene.fog as THREE.Fog;
    fog.near = f.near * this.fogMul;
    fog.far = f.far * this.fogMul;
    (this.scene.background as THREE.Color).setHex(f.bg);

    if (this.kind === 'storm') {
      // dedicated flash light — created once, intensity pulses, count stays fixed
      this.boltLight = new THREE.DirectionalLight(0xffffff, 0);
      this.boltLight.position.set(0, 60, 0);
      this.scene.add(this.boltLight);
      this.boltTarget = new THREE.Object3D();
      this.boltLight.target = this.boltTarget;
      this.scene.add(this.boltTarget);
      this.nextStrike = 1.5 + Math.random() * 4;
    }

    if (this.kind === 'rain' || this.kind === 'storm') this.buildRain(seed);
  }

  private buildRain(seed: number) {
    const base = this.kind === 'storm' ? CONFIG.weather.rainStorm : CONFIG.weather.rain;
    const count = Math.round(base * QUALITY[this.quality].rainScale);
    const pos = new Float32Array(count * 3);
    const rng = mulberry32(seed ^ 0x27d4eb2f);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() * 2 - 1) * this.size;
      pos[i * 3 + 1] = rng() * this.height;
      pos[i * 3 + 2] = (rng() * 2 - 1) * this.size;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9fb4d0,
      size: this.kind === 'storm' ? 0.11 : 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: this.kind === 'storm' ? 0.55 : 0.38,
      depthWrite: false,
      fog: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.position.set(0, 0, 0);
    this.rain = pts;
    this.scene.add(pts);
  }

  /** Spawn a jagged bolt line near the player at a random azimuth. */
  private strike(cam: { x: number; y: number; z: number }) {
    const a = Math.random() * Math.PI * 2;
    const r = 24 + Math.random() * 26;
    const bx = cam.x + Math.sin(a) * r;
    const bz = cam.z + Math.cos(a) * r;

    // point the flash light at the storm so the whole sky sheet pulses
    if (this.boltLight) {
      this.boltLight.position.set(bx, 70, bz);
      this.boltTarget?.position.set(bx, 0, bz);
      this.strikeNow = 1;
    }

    // two parallel-ish strokes for body (a main + a faint echo)
    const strokes = 2;
    for (let s = 0; s < strokes; s++) {
      const pts: THREE.Vector3[] = [];
      const off = s === 1 ? 1.6 : 0;
      const segs = 9;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const jitter = s === 1 ? 0.8 : 1;
        pts.push(
          new THREE.Vector3(
            bx + (Math.random() - 0.5) * 9 * jitter + off * (Math.random() - 0.5),
            62 - t * 58,
            bz + (Math.random() - 0.5) * 9 * jitter
          )
        );
      }
      const mat = new THREE.LineBasicMaterial({
        color: 0xe8efff,
        transparent: true,
        opacity: s === 1 ? 0.35 : 0.85,
        fog: false,
      });
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, mat);
      this.scene.add(line);
      this.bolts.push({ line, mat, life: s === 1 ? 0.5 : 0.42, peak: s === 1 ? 0.35 : 0.85 });
    }
  }

  /** Per-frame: storm flash scheduler, bolt ageing, rain fall + wind drift. */
  update(dt: number, cam: { x: number; y: number; z: number }) {
    if (this.kind === 'storm') {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.nextStrike = 6 + Math.random() * 12; // every 6-18 s
        this.strike(cam);
      }
      // envelope decays fast — a pop, not a glow
      if (this.strikeNow > 0) {
        this.strikeNow = Math.max(0, this.strikeNow - dt * 5);
        if (this.boltLight) {
          const f = this.strikeNow;
          this.boltLight.intensity = f * f * 3.2;
        }
      }
      // age + fade bolt lines
      for (let i = this.bolts.length - 1; i >= 0; i--) {
        const b = this.bolts[i];
        b.life -= dt;
        b.mat.opacity = b.life <= 0 ? 0 : b.peak * Math.min(1, b.life / 0.35);
        if (b.life <= 0) {
          this.scene.remove(b.line);
          b.line.geometry.dispose();
          b.mat.dispose();
          this.bolts.splice(i, 1);
        }
      }
    }

    if (this.rain) {
      const fall = (this.kind === 'storm' ? 42 : 27) * dt;
      const wx = this.wind.x * dt;
      const wz = this.wind.z * dt;
      const arr = this.rain.geometry.attributes.position.array as Float32Array;
      const n = arr.length / 3;
      const S = this.size;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        let y = arr[i3 + 1] - fall;
        if (y < 0) y += this.height; // respawn at the top
        let x = arr[i3] + wx;
        if (x > S) x -= S * 2;
        else if (x < -S) x += S * 2;
        let z = arr[i3 + 2] + wz;
        if (z > S) z -= S * 2;
        else if (z < -S) z += S * 2;
        arr[i3] = x;
        arr[i3 + 1] = y;
        arr[i3 + 2] = z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(cam.x, cam.y - 3, cam.z);
    }
  }

  dispose() {
    if (this.rain) {
      this.scene.remove(this.rain);
      this.rain.geometry.dispose();
      (this.rain.material as THREE.Material).dispose();
      this.rain = null;
    }
    if (this.boltLight) {
      this.scene.remove(this.boltLight);
      this.boltLight = null;
    }
    if (this.boltTarget) {
      this.scene.remove(this.boltTarget);
      this.boltTarget = null;
    }
    for (const b of this.bolts) {
      this.scene.remove(b.line);
      b.line.geometry.dispose();
      b.mat.dispose();
    }
    this.bolts = [];
  }
}
