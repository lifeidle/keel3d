/**
 * fabricTexture — soft canvas-noise fabric bump for soldier uniforms.
 * Mechanism-equivalent to the original nightraid SoldierFactory fabric
 * detail: a 64×64 tiled noise canvas so blocky uniforms read as cloth
 * instead of flat paint. Deterministic-free by design (random speckles
 * per texture); one texture is shared across all uniforms.
 *
 * Headless-safe: without a DOM it returns a 1×1 neutral texture so
 * headless consumers never crash on canvas APIs.
 */
import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';

let _fabric: THREE.Texture | null = null;

/**
 * Shared fabric texture (cached — one texture, many materials).
 * Tiled 2×2 by default; set .repeat per use if needed.
 */
export function fabricTexture(): THREE.Texture {
  if (_fabric) return _fabric;
  if (!HAS_DOM) {
    // headless fallback: neutral 1×1 (no crash, no visual)
    _fabric = new THREE.DataTexture(
      new Uint8Array([110, 110, 110, 255]),
      1,
      1,
      THREE.RGBAFormat,
    );
    return _fabric;
  }
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6e6e6e';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const v = 90 + ((Math.random() * 50) | 0);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect((Math.random() * size) | 0, (Math.random() * size) | 0, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return (_fabric = t);
}
