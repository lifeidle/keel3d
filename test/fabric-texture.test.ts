/**
 * fabricTexture + kitSoldier bodyMap wiring.
 * Headless: no DOM → 1×1 DataTexture fallback (no crash); the body
 * material carries the provided map.
 */
import assert from 'node:assert';
import * as THREE from 'three';
import { fabricTexture } from '../src/blocks/kit/textures';
import { kitSoldier } from '../src/blocks/kit/Soldier';

const t = (name: string, fn: () => void) => {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name, e);
    process.exitCode = 1;
  }
};

t('headless fallback returns a 1×1 texture without DOM APIs', () => {
  const tex = fabricTexture();
  assert.ok(tex instanceof THREE.Texture, 'texture instance');
  // cached: same instance on repeat calls
  assert.strictEqual(tex, fabricTexture(), 'cached singleton');
});

t('kitSoldier body material carries the provided bodyMap', () => {
  const tex = fabricTexture();
  const r = kitSoldier({ body: 0x6f7a52, helmet: 0x3a4046, bodyMap: tex });
  assert.strictEqual(r.bodyMat.map, tex, 'body material map');
});

t('kitSoldier without bodyMap leaves map null', () => {
  const r = kitSoldier({ body: 0x9a5a4a, helmet: 0x3a4046 });
  assert.strictEqual(r.bodyMat.map, null);
});

console.log('fabric-texture tests complete');
