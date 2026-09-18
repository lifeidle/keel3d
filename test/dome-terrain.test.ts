import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  domeHeightField,
  createDomeTerrain,
  createSeededTerrain,
} from '../src/blocks/scene/TerrainBuilder';

/**
 * Data-driven dome terrain (TerrainBuilder block).
 * domeHeightField is pure (no three/Rapier) → headless-assertable.
 * createDomeTerrain accepts physics=null → mesh assembly is headless-safe
 * (three only); the trimesh collider path is covered by the yexi probes.
 */

test('domeHeightField: flat core is exactly zero inside its radius', () => {
  const h = domeHeightField({
    domes: [{ x: 2, z: -16, h: 4.2, sigma: 13 }],
    flatCore: 7,
    flatRamp: 6,
  });
  for (const [x, z] of [
    [0, 0],
    [3, 4], // r = 5
    [-5, 0], // r = 5
    [0, -6.9], // r = 6.9
  ] as const) {
    assert.equal(h(x, z), 0, `inside flat core r=${Math.hypot(x, z)}`);
  }
});

test('domeHeightField: peak ≈ declared h, decays monotonically with distance', () => {
  const h = domeHeightField({ domes: [{ x: 0, z: 0, h: 4, sigma: 10 }] });
  assert.ok(Math.abs(h(0, 0) - 4) < 0.01, `peak ${h(0, 0)}`);
  const d5 = h(0, 5);
  const d10 = h(0, 10);
  const d30 = h(0, 30);
  assert.ok(d5 > d10 && d10 > d30 && d30 > 0, `${d5} > ${d10} > ${d30}`);
});

test('domeHeightField: domes sum; multiple hills independent', () => {
  const h = domeHeightField({
    domes: [
      { x: 0, z: 0, h: 2, sigma: 5 },
      { x: 20, z: 0, h: 3, sigma: 5 },
    ],
  });
  assert.ok(Math.abs(h(0, 0) - 2) < 0.05);
  assert.ok(Math.abs(h(20, 0) - 3) < 0.05);
  // between the two: well below both peaks (σ5 Gaussians overlap ~0.68 here)
  assert.ok(h(10, 0) < 0.5 * Math.min(h(0, 0), h(20, 0)), `midpoint ${h(10, 0)}`);
});

test('domeHeightField: ripple is deterministic and bounded by amp', () => {
  const h = domeHeightField({ domes: [], ripple: { amp: 0.3, a: 0.19, b: 0.31 } });
  assert.equal(h(3.7, -8.2), h(3.7, -8.2));
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() * 2 - 1) * 40;
    const z = (Math.random() * 2 - 1) * 40;
    assert.ok(Math.abs(h(x, z)) <= 0.3 + 1e-9, `ripple out of band at ${x},${z}`);
  }
});

test('domeHeightField: flat-core fade smoothsteps the ripple too', () => {
  const h = domeHeightField({
    domes: [{ x: 0, z: -16, h: 4.2, sigma: 13 }],
    ripple: { amp: 0.3, a: 0.19, b: 0.31 },
    flatCore: 7,
    flatRamp: 6,
  });
  // at the dome centre (r=16, past the ramp end): full height
  const full = h(0, -16);
  assert.ok(full > 3.5, `outside fade ${full}`);
  // mid-transition (r=10, k=0.5 → fade 0.5): strictly between 0 and full
  const mid = h(0, -10);
  assert.ok(mid > 0 && mid < full, `mid ${mid} between 0 and ${full}`);
});

test('createDomeTerrain: mesh vertices match heightAt (headless, physics=null)', () => {
  const h = domeHeightField({
    domes: [{ x: 2, z: -16, h: 4.2, sigma: 13 }],
    flatCore: 7,
    flatRamp: 6,
  });
  const t = createDomeTerrain(null, {
    size: 80,
    seg: 32,
    materialColor: 0x3f4c5c,
    heightAt: h,
    name: 'test-terrain',
  });
  const pos = t.mesh.geometry.attributes.position as {
    count: number;
    getX: (i: number) => number;
    getY: (i: number) => number;
    getZ: (i: number) => number;
  };
  let maxErr = 0;
  for (let i = 0; i < pos.count; i++) {
    maxErr = Math.max(maxErr, Math.abs(pos.getY(i) - h(pos.getX(i), pos.getZ(i))));
  }
  assert.ok(maxErr < 1e-6, `vertex drift ${maxErr}`);
  assert.ok(t.mesh.geometry.index, 'triangulated index (trimesh collider source)');
  assert.equal(t.mesh.name, 'test-terrain');
  assert.equal(t.heightAt(2, -16), h(2, -16), 'heightAt pass-through');
  t.dispose();
});

test('createDomeTerrain: dome data without heightAt (default field)', () => {
  const t = createDomeTerrain(null, {
    size: 80,
    seg: 16,
    domes: [{ x: 2, z: -16, h: 4.2, sigma: 13 }],
    flatCore: 7,
    flatRamp: 6,
  });
  assert.ok(Math.abs(t.heightAt(0, 0)) < 0.001, 'flat core stays zero');
  assert.ok(Math.abs(t.heightAt(2, -16) - 4.2) < 0.05, 'dome peak');
  assert.equal(t.mesh.name, 'terrain', 'default name');
  t.dispose();
});

test('createSeededTerrain: still works through the shared assembly (regression)', () => {
  const t = createSeededTerrain(null, { seed: 42, size: 60, amplitude: 3 });
  assert.equal(t.mesh.name, 'seeded-terrain');
  assert.ok(Number.isFinite(t.heightAt(5, -5)));
  // deterministic per seed
  const u = createSeededTerrain(null, { seed: 42, size: 60, amplitude: 3 });
  assert.equal(u.heightAt(5, -5), t.heightAt(5, -5));
  t.dispose();
  u.dispose();
});
