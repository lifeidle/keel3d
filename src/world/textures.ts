// Procedural canvas textures — 100% ours, no third-party assets.
// Generated lazily (on first use, in the browser) and cached as singletons so
// the build stays asset-free and the Node test suite (which imports terrain.ts
// via mapgen but has no DOM) is unaffected: without `document` we return a
// neutral 1x1 fallback texture instead of touching the canvas API.
import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';

let _ground: THREE.Texture | null = null;
let _fabric: THREE.Texture | null = null;
let _metal: THREE.Texture | null = null;

/** Neutral 1x1 stand-in used when there is no DOM (Node test runs). */
function fallback(repeat: number): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([140, 140, 128, 255]), 1, 1, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function makeCanvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, repeat: number): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Warm-grey dirt speckle. Intended to MULTIPLY the terrain's vertex colours,
 *  so it stays neutral-ish and just adds granular detail under the moonlight. */
export function groundTexture(): THREE.Texture {
  if (_ground) return _ground;
  if (!HAS_DOM) return (_ground = fallback(48));
  const size = 256;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#8c8a80';
  ctx.fillRect(0, 0, size, size);
  // fine grain
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 46;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.85));
  }
  ctx.putImageData(img, 0, 0);
  // a few darker pebbles / scuffs
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 3;
    ctx.fillStyle = `rgba(40,38,32,${0.12 + Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  _ground = finish(c, 48);
  return _ground;
}

/** Olive/khaki woven uniform cloth — subtle horizontal+vertical thread flecks. */
export function fabricTexture(): THREE.Texture {
  if (_fabric) return _fabric;
  if (!HAS_DOM) return (_fabric = fallback(3));
  const size = 128;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#5b6347';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const v = (Math.random() - 0.5) * 26;
      ctx.fillStyle = `rgba(${91 + v},${99 + v},${71 + v},0.5)`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  _fabric = finish(c, 3);
  return _fabric;
}

/** Brushed steel — faint horizontal streaks, used on weapon bodies. */
export function metalTexture(): THREE.Texture {
  if (_metal) return _metal;
  if (!HAS_DOM) return (_metal = fallback(1));
  const size = 128;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#3a3f46';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * size;
    const x = Math.random() * size;
    const w = 6 + Math.random() * 26;
    const g = 40 + (Math.random() - 0.5) * 34;
    ctx.strokeStyle = `rgba(${g},${g + 4},${g + 8},0.18)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  }
  _metal = finish(c, 1);
  return _metal;
}

let _crate: THREE.Texture | null = null;
let _concrete: THREE.Texture | null = null;
let _sandbag: THREE.Texture | null = null;

/** Wooden military crate: horizontal planks + two dark cross straps + nails. */
export function crateTexture(): THREE.Texture {
  if (_crate) return _crate;
  if (!HAS_DOM) return (_crate = fallback(1));
  const size = 128;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(0, 0, size, size);
  // plank rows (horizontal), each with its own tone
  const row = size / 4;
  for (let r = 0; r < 4; r++) {
    const t = 60 + (Math.random() - 0.5) * 40; // hue-ish shift via rgb
    ctx.fillStyle = `rgba(${138 + t * 0.25},${106 + t * 0.2},${68 + t * 0.1},0.55)`;
    ctx.fillRect(0, r * row, size, row - 1);
    // plank grain
    for (let g = 0; g < 7; g++) {
      const gy = r * row + 2 + Math.random() * (row - 4);
      ctx.strokeStyle = `rgba(60,42,22,${0.08 + Math.random() * 0.12})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(size, gy + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }
  }
  // vertical cross straps
  for (const sx of [size * 0.28, size * 0.78]) {
    ctx.fillStyle = 'rgba(64,44,24,0.85)';
    ctx.fillRect(sx - 4, 0, 9, size);
    ctx.fillStyle = 'rgba(150,120,80,0.25)';
    ctx.fillRect(sx - 4, 0, 2, size);
    // nails along the straps
    for (let ny = 10; ny < size; ny += 16) {
      ctx.fillStyle = 'rgba(40,30,18,0.9)';
      ctx.beginPath();
      ctx.arc(sx + 0.5, ny, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  _crate = finish(c, 1);
  return _crate;
}

/** Poured-concrete block wall: offset block seams, hairline cracks, stains. */
export function concreteTexture(): THREE.Texture {
  if (_concrete) return _concrete;
  if (!HAS_DOM) return (_concrete = fallback(1));
  const size = 128;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#5b6068';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // block seams (two courses, offset on the lower row)
  const seam = (y: number, off: number) => {
    ctx.fillStyle = 'rgba(26,30,36,0.5)';
    ctx.fillRect(0, y - 1, size, 2);
    for (let x = off - 32; x < size; x += 64) {
      ctx.fillRect(x - 1, 0, 2, y + 2);
    }
  };
  seam(44, 0);
  seam(88, 32);
  // hairline cracks
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(20,24,28,${0.1 + Math.random() * 0.15})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      y += 4 + Math.random() * 10;
      ctx.lineTo(x + (Math.random() - 0.5) * 16, y);
    }
    ctx.stroke();
  }
  // damp stains near the bottom
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * size;
    const y = size - 6 - Math.random() * 18;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 10 + Math.random() * 14);
    g.addColorStop(0, 'rgba(24,30,36,0.25)');
    g.addColorStop(1, 'rgba(24,30,36,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 10 + Math.random() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  _concrete = finish(c, 1);
  return _concrete;
}

/** Woven burlap sandbag: warm tan speckle + faint diagonal crosshatch. */
export function sandbagTexture(): THREE.Texture {
  if (_sandbag) return _sandbag;
  if (!HAS_DOM) return (_sandbag = fallback(1));
  const size = 128;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#77653f';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 40;
    img.data[i] += n;
    img.data[i + 1] += n * 0.9;
    img.data[i + 2] += n * 0.6;
  }
  ctx.putImageData(img, 0, 0);
  // diagonal weave, both directions
  ctx.strokeStyle = 'rgba(50,42,24,0.16)';
  ctx.lineWidth = 1;
  for (let k = -size; k < size * 2; k += 5) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + size, size);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(160,140,100,0.10)';
  for (let k = -size; k < size * 2; k += 5) {
    ctx.beginPath();
    ctx.moveTo(k + size, 0);
    ctx.lineTo(k, size);
    ctx.stroke();
  }
  _sandbag = finish(c, 1);
  return _sandbag;
}

let _scorch: THREE.Texture | null = null;

/** Charred ground: near-black centre, blotchy irregular edge, faint scorch
 *  rings. Used by shell craters and the decal left after a barrel blows up. */
export function scorchTexture(): THREE.Texture {
  if (_scorch) return _scorch;
  if (!HAS_DOM) return (_scorch = fallback(1));
  const size = 256;
  const { c, ctx } = makeCanvas(size);
  ctx.clearRect(0, 0, size, size);
  // blotchy noise pass first (read through the radial masks)
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  // multiply-ish shaping: keep dark core, burn out an irregular edge
  const cx = size / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px - cx;
      const dy = py - cx;
      const d = Math.hypot(dx, dy) / cx;
      // wobbly radius per angle
      const a = Math.atan2(dy, dx);
      const rr = 0.62 + 0.2 * Math.sin(a * 5 + Math.sin(a * 2) * 2);
      const edge = 1 - Math.min(1, Math.max(0, (d - rr * 0.4) / (rr * 0.6)));
      const k = Math.pow(Math.max(0, 1 - d / 1.15), 1.4) * edge;
      const i = (py * size + px) * 4;
      const shade = Math.max(0, Math.min(255, 12 + (1 - k) * 30 + Math.random() * 10));
      img.data[i] = shade * 0.9;
      img.data[i + 1] = shade * 0.85;
      img.data[i + 2] = shade * 0.7;
      img.data[i + 3] = Math.round(k * 255 * 0.95);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (_scorch = t);
}


/** Small dark bullet-hole blot for impact decals. */
export function bulletHoleTexture(): THREE.Texture {
  if (!HAS_DOM) {
    return new THREE.DataTexture(new Uint8Array([10, 10, 10, 255]), 1, 1, THREE.RGBAFormat);
  }
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  // ragged hole: dark core + a few scratch marks radiating out
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size * 0.42);
  g.addColorStop(0, 'rgba(4,4,4,0.95)');
  g.addColorStop(0.55, 'rgba(10,10,12,0.75)');
  g.addColorStop(1, 'rgba(20,20,22,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(8,8,8,0.8)';
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const r0 = 2 + Math.random() * 6;
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(size / 2 + Math.cos(a) * r0, size / 2 + Math.sin(a) * r0);
    ctx.lineTo(size / 2 + Math.cos(a) * (r0 + 6 + Math.random() * 8), size / 2 + Math.sin(a) * (r0 + 6 + Math.random() * 8));
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Two parallel dark tread bands (tank parking / drive marks). */
export function rutTexture(): THREE.Texture {
  if (!HAS_DOM) {
    return new THREE.DataTexture(new Uint8Array([30, 28, 22, 200]), 1, 1, THREE.RGBAFormat);
  }
  const W = 256;
  const H = 64;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  for (const bandY of [H * 0.28, H * 0.72]) {
    const h = 7 + Math.random() * 4;
    const g = ctx.createLinearGradient(0, bandY - h, 0, bandY + h);
    g.addColorStop(0, 'rgba(25,22,16,0)');
    g.addColorStop(0.5, 'rgba(25,22,16,0.55)');
    g.addColorStop(1, 'rgba(25,22,16,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, bandY - h, W, h * 2);
    // tread ticks
    ctx.fillStyle = 'rgba(12,11,8,0.5)';
    for (let x = 0; x < W; x += 10) {
      ctx.fillRect(x, bandY - 5, 4, 10);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
