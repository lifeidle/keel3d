// Ambient battlefield fires (campfires / brush blazes) ?purely cosmetic
// light+flame scenery placed by generateMap and disposed with the map.
//
// LIGHT DISCIPLINE: one PointLight per site, created once at map build and
// never added/removed afterwards. A constant scene light count is what keeps
// THREE from recompiling every MeshStandardMaterial mid-fight (adding/removing
// lights per frame was the original "plays fine then freezes" culprit).
//
// DOM note: like textures.ts, this module must survive the Node test suite
// (mapgen.test.ts calls generateMap headlessly) so flame textures degrade to a
// neutral 1x1 when there is no document.
import * as THREE from 'three';
import { CONFIG } from '../../config';

const HAS_DOM = typeof document !== 'undefined';

interface Site {
  light: THREE.PointLight;
  core: THREE.Sprite; // bright inner flame
  outer: THREE.Sprite; // orange envelope
  halo: THREE.Mesh; // flat additive glow on the ground (readable from the menu orbit)
  base: number; // light mean intensity
  scale: number; // flame height multiplier (big blazes vs low campfires)
  phase: number;
  t: number;
}

let _flameTex: THREE.Texture | null = null;
let _glowTex: THREE.Texture | null = null;

/** Radial flame gradient ?white-hot core, orange falloff, transparent rim. */
function flameTexture(): THREE.Texture {
  if (_flameTex) return _flameTex;
  if (!HAS_DOM) {
    return (_flameTex = new THREE.DataTexture(new Uint8Array([255, 170, 90, 255]), 1, 1, THREE.RGBAFormat));
  }
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size * 0.42, 1, size / 2, size * 0.42, size * 0.46);
  g.addColorStop(0, 'rgba(255,250,235,1)');
  g.addColorStop(0.22, 'rgba(255,214,130,0.95)');
  g.addColorStop(0.55, 'rgba(255,138,48,0.55)');
  g.addColorStop(1, 'rgba(255,90,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (_flameTex = t);
}

/** Soft radial glow for the ground halo. */
function glowTexture(): THREE.Texture {
  if (_glowTex) return _glowTex;
  if (!HAS_DOM) {
    return (_glowTex = new THREE.DataTexture(new Uint8Array([255, 130, 40, 255]), 1, 1, THREE.RGBAFormat));
  }
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,150,50,0.55)');
  g.addColorStop(0.5, 'rgba(255,110,30,0.22)');
  g.addColorStop(1, 'rgba(255,80,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (_glowTex = t);
}

/** Deterministic flicker in 0..1: three detuned sines + phase. */
function flicker(t: number, phase: number): number {
  const f = 0.5 + 0.5 * Math.sin(t * 9.7 + phase);
  const j = 0.5 + 0.5 * Math.sin(t * 18.3 + phase * 2.1 + 1.7);
  const k = 0.5 + 0.5 * Math.sin(t * 27.9 + phase * 3.3 + 4.1);
  return THREE.MathUtils.clamp(f * 0.42 + j * 0.33 + k * 0.25, 0, 1);
}

export class FireSites {
  group = new THREE.Group();
  private sites: Site[] = [];
  /** Day dimming ?flames stay visible, their light fades to embers. */
  private dayFactor = 1;

  /**
   * Add one fire site. `big` picks a tall brush blaze instead of a low
   * campfire. `y` is the ground height; all geometry sits on top of it.
   */
  addSite(x: number, y: number, z: number, big = false): void {
    const cfg = CONFIG.fires;
    const scale = big ? 1.9 : 1;
    const base = cfg.lightBase * (big ? 1.35 : 1);

    const matCore = new THREE.SpriteMaterial({
      map: flameTexture(),
      color: 0xfff6d8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
      fog: false,
    });
    const matOuter = new THREE.SpriteMaterial({
      map: flameTexture(),
      color: 0xff7a24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.55,
      fog: false,
    });
    const core = new THREE.Sprite(matCore);
    core.scale.set(0.5, 0.55, 1);
    const outer = new THREE.Sprite(matOuter);
    outer.scale.set(1.0, 1.25, 1);

    // flat additive halo on the ground ?sprites would read edge-on from the
    // menu's high orbit camera, so a horizontal plane is used instead
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4 * scale, 3.4 * scale),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.4,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(x, y + 0.07, z);
    halo.renderOrder = 1;

    const light = new THREE.PointLight(0xffa14a, base, cfg.lightDist, 2);
    light.position.set(x, y + 1.1 * scale + 0.4, z);

    const s: Site = {
      light,
      core,
      outer,
      halo,
      base,
      scale,
      phase: Math.random() * Math.PI * 2,
      t: Math.random() * 100,
    };

    // pit rim (campfire) or criss-cross logs (blaze) under the flames
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x2e241a, roughness: 1 });
    if (!big) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 6, 10), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, y + 0.12, z);
      this.group.add(rim);
    } else {
      for (let i = 0; i < 4; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), rimMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (i / 4) * Math.PI;
        log.position.set(x, y + 0.12, z);
        this.group.add(log);
      }
    }

    const fx = new THREE.Group();
    fx.position.set(x, y + (big ? 0.55 : 0.3), z);
    fx.add(outer, core);
    this.group.add(fx, halo, light);
    this.sites.push(s);
  }

  /** Advance every flame + light flicker. Cheap: a few sin() per site. */
  update(dt: number) {
    for (const s of this.sites) {
      s.t += dt * (2.2 + 2 * Math.random());
      const fl = flicker(s.t, s.phase);
      const h = (0.8 + fl * 0.55) * s.scale;
      s.core.scale.set(h * 0.55, h * 0.62, 1);
      s.outer.scale.set(h * 1.05, h * 1.25, 1);
      s.core.position.y = h * 0.55;
      s.outer.position.y = h * 0.42;
      s.light.intensity = s.base * (0.66 + fl * 0.55) * this.dayFactor;
      s.halo.scale.setScalar(1 + fl * 0.12);
      (s.halo.material as THREE.MeshBasicMaterial).opacity = 0.28 + fl * 0.2;
    }
  }

  /** Day/night: bright at night, ember-dim by day (flames stay visible). */
  setDay(day: boolean) {
    this.dayFactor = day ? 0.1 : 1;
  }

  /** Remove everything (map regenerate). Shared textures are kept alive. */
  dispose() {
    this.group.traverse((o) => {
      const spr = o as THREE.Sprite;
      if (spr.isSprite) {
        spr.material.dispose();
        return;
      }
      const m = o as THREE.Mesh;
      if (m.geometry) {
        m.geometry.dispose();
        const mat = (m as unknown as { material?: THREE.Material }).material;
        if (mat) mat.dispose();
      }
    });
    this.group.clear();
    this.sites = [];
  }
}
