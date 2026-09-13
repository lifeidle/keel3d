// Renderer, scene, camera, lights, and the base world (ground + night sky).
// Night-raid atmosphere: cold moonlight, starfield, dark ground.
import * as THREE from 'three';
import { CONFIG } from '../config';
import { PhysicsWorld } from '../physics/world';
import { QUALITY, type Quality } from '../world/quality';
const HAS_DOM = typeof document !== 'undefined';
/** Procedural milky-way band + dense star flecks for the night dome. */
/** Night sky texture: deep black, round stars, a clustered galactic band. */
function nightSkyTexture(): THREE.Texture {
  if (!HAS_DOM) {
    return new THREE.DataTexture(new Uint8Array([10, 14, 24, 255]), 1, 1, THREE.RGBAFormat);
  }
  const W = 2048;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = Math.random;
  const star = (x: number, y: number, r: number, rgba: string) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba;
    ctx.fill();
  };
  const deep = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  deep.addColorStop(0, 'rgba(1,2,6,0.9)');
  deep.addColorStop(0.5, 'rgba(2,4,10,0.35)');
  deep.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = deep;
  ctx.fillRect(0, 0, W, H * 0.55);
  // --- the galactic band: broad soft corridor with real clustering ---
  const yc = H * 0.6;
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * W + (rnd() - 0.5) * 60;
    const y = yc + (rnd() - 0.5) * 34;
    const r = 90 + rnd() * 90;
    const warm = rnd() < 0.55;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    const a = 0.02 + rnd() * 0.03;
    g.addColorStop(0, warm ? 'rgba(255,242,220,' + a.toFixed(3) + ')' : 'rgba(205,220,255,' + a.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * W + (rnd() - 0.5) * 90;
    const y = yc + (rnd() - 0.5) * 16;
    const r = 34 + rnd() * 46;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(255,244,224,' + (0.05 + rnd() * 0.05).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 4; i++) {
    const x = rnd() * W;
    const y = yc + (rnd() - 0.5) * 30;
    const r = 46 + rnd() * 80;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 620; i++) {
    const x = rnd() * W;
    const y = yc + (rnd() + rnd() - 1) * 60;
    const roll = rnd();
    const warm = roll < 0.62;
    const cool = roll >= 0.62 && roll < 0.9;
    const col = warm
      ? 'rgba(255,246,226,' + (0.35 + rnd() * 0.6).toFixed(2) + ')'
      : cool
        ? 'rgba(205,220,255,' + (0.3 + rnd() * 0.6).toFixed(2) + ')'
        : 'rgba(255,224,190,' + (0.3 + rnd() * 0.5).toFixed(2) + ')';
    star(x, y, 0.5 + rnd() * 1.1, col);
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = yc + (rnd() + rnd() - 1) * 44;
    star(x, y, 1.6 + rnd() * 1.1, 'rgba(255,250,238,' + (0.7 + rnd() * 0.3).toFixed(2) + ')');
  }
  for (let i = 0; i < 520; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    if (Math.abs(y - yc) < 62 && rnd() < 0.55) continue;
    const a = 0.15 + rnd() * 0.75;
    const cool = rnd() < 0.8;
    star(x, y, 0.4 + rnd() * 0.9, cool ? 'rgba(210,224,255,' + a.toFixed(2) + ')' : 'rgba(255,240,224,' + a.toFixed(2) + ')');
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Day sky texture: blue gradient, cumulus clouds, hazy horizon. */
function daySkyTexture(): THREE.Texture {
  if (!HAS_DOM) {
    return new THREE.DataTexture(new Uint8Array([120, 170, 220, 255]), 1, 1, THREE.RGBAFormat);
  }
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = Math.random;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#3567a8');
  sky.addColorStop(0.42, '#5f92c9');
  sky.addColorStop(0.72, '#93bde2');
  sky.addColorStop(0.92, '#cfe3f2');
  sky.addColorStop(1, '#e8f3fb');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const puff = (x: number, y: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(2) + ')');
    g.addColorStop(0.75, 'rgba(255,255,255,' + (a * 0.65).toFixed(2) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (let i = 0; i < 15; i++) {
    const x = rnd() * W;
    const y = 40 + rnd() * H * 0.42;
    const r = 26 + rnd() * 52;
    const a = 0.5 + rnd() * 0.4;
    puff(x, y, r, a);
    const extra = 2 + ((rnd() * 2) | 0);
    for (let e = 0; e < extra; e++) {
      puff(x + (rnd() - 0.5) * r * 2.2, y + (rnd() - 0.5) * r * 0.8, r * (0.6 + rnd() * 0.55), a * 0.85);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = rnd() * W;
    const y = 30 + rnd() * H * 0.3;
    const g = ctx.createLinearGradient(x, y, x + 130 + rnd() * 160, y + 10);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,' + (0.12 + rnd() * 0.1).toFixed(2) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, y - 20, 320, 40);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Thin drifting cloud wisps for the night sky. */
function cloudBandTexture(): THREE.Texture {
  if (!HAS_DOM) {
    return new THREE.DataTexture(new Uint8Array([160, 170, 190, 60]), 1, 1, THREE.RGBAFormat);
  }
  const W = 2048;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = Math.random;
  for (let i = 0; i < 8; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const w = 300 + rnd() * 620;
    const h = 18 + rnd() * 46;
    const g = ctx.createLinearGradient(0, y - h, 0, y + h);
    const a = 0.25 + rnd() * 0.3;
    g.addColorStop(0, 'rgba(180,195,215,0)');
    g.addColorStop(0.5, 'rgba(190,205,225,' + a.toFixed(2) + ')');
    g.addColorStop(1, 'rgba(180,195,215,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, y - h, w, h * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Minimal WebGPU renderer surface (three/webgpu). */
export interface GpuRendererLike {
  init(): Promise<void>;
  /** Sync present after init — renderAsync is deprecated in three r186. */
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setPixelRatio(v: number): void;
  setSize(w: number, h: number, updateStyle?: boolean): void;
  dispose(): void;
  domElement: HTMLCanvasElement;
  shadowMap?: { enabled: boolean; type: number; needsUpdate?: boolean };
  outputColorSpace?: string;
}

export type AnyGameRenderer = GpuRendererLike;

/**
 * This framework is WebGPU-only (no backward compatibility). A browser without
 * a WebGPU adapter cannot run it — callers must surface the error page.
 */
export class WebGpuRequiredError extends Error {
  constructor(reason: string) {
    super(`WebGPU required — this framework does not support WebGL. ${reason}`);
    this.name = 'WebGpuRequiredError';
  }
}

export interface Engine {
  renderer: AnyGameRenderer;
  backend: 'webgpu';
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  moon: THREE.DirectionalLight; // doubles as the sun in day mode
  hemi: THREE.HemisphereLight;
  skyNight: THREE.Group | null; // stars + moon disc, shown at night
  skyDay: THREE.Group | null; // sun disc, shown by day
}

function buildSceneGraph(q: (typeof QUALITY)[Quality]): Pick<Engine, 'scene' | 'camera' | 'moon' | 'hemi'> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.colors.sky);
  scene.fog = new THREE.Fog(CONFIG.colors.fog, 40, 170);
  const camera = new THREE.PerspectiveCamera(
    CONFIG.player.fov,
    window.innerWidth / window.innerHeight,
    0.05,
    600
  );
  const hemi = new THREE.HemisphereLight(0x46648f, 0x1c2418, 0.6);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xbfd4ff, 0.55);
  moon.castShadow = q.shadows;
  moon.shadow.mapSize.set(q.shadowSize, q.shadowSize);
  const d = 170; // shadow frustum half-extent — covers the whole 85m arena + rim
  moon.shadow.camera.left = -d;
  moon.shadow.camera.right = d;
  moon.shadow.camera.top = d;
  moon.shadow.camera.bottom = -d;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 300;
  moon.shadow.bias = -0.0005;
  scene.add(moon);
  scene.add(moon.target);
  return { scene, camera, moon, hemi };
}

/**
 * Probe for a WebGPU adapter. Returns the adapter, or null when the browser
 * cannot run this framework (no WebGPU — no fallback by design).
 */
export async function probeWebGPU(): Promise<unknown | null> {
  try {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return null;
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return null;
    return await gpu.requestAdapter();
  } catch {
    return null;
  }
}

/**
 * WebGPU-only boot. No WebGL fallback (no backward compatibility): when the
 * browser has no WebGPU adapter this rejects with WebGpuRequiredError — the
 * entry point must surface the error page ("本框架需 WebGPU").
 */
export async function createEngineAsync(parent: HTMLElement, quality: Quality): Promise<Engine> {
  const q = QUALITY[quality];
  const adapter = await probeWebGPU();
  if (!adapter) throw new WebGpuRequiredError('no WebGPU adapter');
  const mod = await import('three/webgpu');
  const Ctor = (mod as unknown as { WebGPURenderer: new (p?: unknown) => GpuRendererLike })
    .WebGPURenderer;
  const renderer = new Ctor({ antialias: true, powerPreference: 'high-performance' });
  await renderer.init();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = q.shadows;
    // PCFSoft removed in three r180+; PCF is the supported soft filter.
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  parent.appendChild(renderer.domElement);
  const g = buildSceneGraph(q);
  console.info('[createEngineAsync] backend=webgpu');
  return { renderer, backend: 'webgpu', ...g, skyNight: null, skyDay: null };
}
export interface SkyDressing {
  night: THREE.Group; // stars + moon disc
  day: THREE.Group; // sun disc
}
/** Builds the sky dressing (stars + moon disc by night, sun disc by day) and
 *  registers the ground collider. Returns both groups so applyDayNight can
 *  toggle their visibility. */
export function buildWorld(scene: THREE.Scene, physics: PhysicsWorld): SkyDressing {
  const skyDressing = new THREE.Group(); // night: stars + moon
  scene.add(skyDressing);
  // --- starfield dome (fog-exempt); the ground is the terrain mesh now ---
  const N = 600;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    // random direction on the upper hemisphere
    const u = Math.random();
    const v = Math.random() * 0.85 + 0.15; // keep above horizon
    const theta = u * Math.PI * 2;
    const phi = Math.acos(v);
    const r = 420;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xaec6e8,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.8,
    fog: false,
  });
  skyDressing.add(new THREE.Points(starGeo, starMat));
  // --- night sky dome: deep black, round stars, a clustered galactic band.
  // Tilted so the band arcs across the sky instead of hugging the horizon.
  const nightSky = new THREE.Mesh(
    new THREE.SphereGeometry(432, 64, 26, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshBasicMaterial({
      map: nightSkyTexture(),
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      fog: false,
    })
  );
  nightSky.rotation.x = 0.5;
  skyDressing.add(nightSky);
  // --- thin drifting cloud wisps (slow rotation driven by the game loop) ---
  const cloudBand = new THREE.Mesh(
    new THREE.SphereGeometry(433.5, 48, 14, 0, Math.PI * 2, 0, Math.PI * 0.44),
    new THREE.MeshBasicMaterial({
      map: cloudBandTexture(),
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.BackSide,
      fog: false,
    })
  );
  cloudBand.name = 'nightClouds';
  skyDressing.add(cloudBand);
  // --- a faint moon disc up where the moonlight comes from ---
  // (purely cosmetic; its tint never tracks the per-seed moonlight intensity,
  //  but it anchors where the light source "is" so the sky reads coherently)
  const moonDir = new THREE.Vector3(-50, 90, -30).normalize();
  const moonPos = moonDir.multiplyScalar(400);
  const moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(11, 24),
    new THREE.MeshBasicMaterial({ color: 0xdbe4f2, fog: false })
  );
  moonDisc.position.copy(moonPos);
  moonDisc.lookAt(0, 0, 0);
  const moonHalo = new THREE.Mesh(
    new THREE.CircleGeometry(24, 32),
    new THREE.MeshBasicMaterial({
      color: 0xb9c8e4,
      transparent: true,
      opacity: 0.18,
      fog: false,
      depthWrite: false,
    })
  );
  moonHalo.position.copy(moonPos);
  moonHalo.lookAt(0, 0, 0);
  skyDressing.add(moonDisc, moonHalo);
  // --- a warm sun disc for day mode, parked where the palette sun shines ---
  const sunDir = new THREE.Vector3(70, 120, 40).normalize();
  const sunPos = sunDir.multiplyScalar(400);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(14, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3d0, fog: false })
  );
  sunDisc.position.copy(sunPos);
  sunDisc.lookAt(0, 0, 0);
  const sunHalo = new THREE.Mesh(
    new THREE.CircleGeometry(40, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffe9b8,
      transparent: true,
      opacity: 0.25,
      fog: false,
      depthWrite: false,
    })
  );
  sunHalo.position.copy(sunPos);
  sunHalo.lookAt(0, 0, 0);
  const dayDressing = new THREE.Group();
  // blue-sky dome with cumulus clouds — covers the flat background by day
  const daySky = new THREE.Mesh(
    new THREE.SphereGeometry(432, 64, 26, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshBasicMaterial({
      map: daySkyTexture(),
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    })
  );
  daySky.name = 'daySkyDome';
  dayDressing.add(daySky);
  dayDressing.add(sunDisc, sunHalo);
  dayDressing.visible = false; // night boots first; applyDayNight flips it
  scene.add(dayDressing);
  // the terrain trimesh is the walkable ground; this is only a fallback net
  physics.addSafetyFloor();
  return { night: skyDressing, day: dayDressing };
}
