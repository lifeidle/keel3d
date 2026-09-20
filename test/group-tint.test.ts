import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dimGroup } from '../src/blocks/props/GroupTint';

/**
 * R87 — dimGroup (darken a prop group; shared materials once; restore).
 */

function mesh(color: number, emissive = false): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color });
  if (emissive) mat.emissive = new THREE.Color(0x332211);
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
}

// NOTE: THREE.Color stores LINEAR values (ColorManagement sRGB→linear), so
// expectations are computed through THREE's own conversion, not raw 0-255.

test('dim scales colours (and emissive) by the factor', () => {
  const g = new THREE.Group();
  const m = mesh(0x888888, true);
  const origR = new THREE.Color(0x888888).r;
  const eMat = m.material as THREE.MeshStandardMaterial;
  const eBeforeR = eMat.emissive.r;
  g.add(m);
  const h = dimGroup(g, 0.5);
  const c = eMat.color;
  assert.ok(Math.abs(c.r - origR * 0.5) < 0.02, `r ×0.5 (got ${c.r})`);
  assert.ok(Math.abs(eMat.emissive.r - eBeforeR * Math.min(1, 0.5 * 1.2)) < 0.02,
    `emissive ×0.6 (got ${eMat.emissive.r})`);
  assert.ok(h.meshes.length === 1, 'mesh collected');
});

test('shared material is dimmed exactly once', () => {
  const g = new THREE.Group();
  const shared = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  g.add(a, b);
  const origR = new THREE.Color(0x888888).r;
  const h = dimGroup(g, 0.5);
  const r = shared.color.r;
  // dimmed ONCE: origR×0.5 — NOT twice (origR×0.25)
  assert.ok(Math.abs(r - origR * 0.5) < 0.02, `single dim (got ${r})`);
  assert.ok(Math.abs(r - origR * 0.25) > 0.02, 'not double-dimmed');
  assert.equal(h.meshes.length, 2, 'both meshes collected');
  h.restore();
  assert.ok(Math.abs(shared.color.r - origR) < 0.02, 'restored');
});

test('restore reverts to the original colours', () => {
  const g = new THREE.Group();
  const m1 = mesh(0xff0000);
  const m2 = mesh(0x00ff00);
  g.add(m1, m2);
  const r1 = m1.material as THREE.MeshStandardMaterial;
  const r2 = m2.material as THREE.MeshStandardMaterial;
  const h = dimGroup(g, 0.3);
  assert.ok(Math.abs(r1.color.r - new THREE.Color(0xff0000).r * 0.3) < 0.02, 'dimmed');
  h.restore();
  assert.equal(r1.color.getHex(), 0xff0000, 'm1 restored');
  assert.equal(r2.color.getHex(), 0x00ff00, 'm2 restored');
});

test('validation: factor must be positive', () => {
  const g = new THREE.Group();
  g.add(mesh(0xffffff));
  assert.throws(() => dimGroup(g, 0), /factor/);
  assert.throws(() => dimGroup(g, NaN), /factor/);
  // non-mesh children are ignored
  const g2 = new THREE.Group();
  g2.add(new THREE.Group());
  const h2 = dimGroup(g2);
  assert.equal(h2.meshes.length, 0);
});
