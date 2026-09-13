import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Terrain } from '../src/world/terrain';

test('Terrain.heightAt is byte-identical for the same seed', () => {
  const a = new Terrain(12345);
  const b = new Terrain(12345);
  const c = new Terrain(99999);
  let maxDiff = 0;
  for (let i = 0; i < 200; i++) {
    const x = (Math.random() * 2 - 1) * 60;
    const z = (Math.random() * 2 - 1) * 60;
    const ha = a.heightAt(x, z);
    const hb = b.heightAt(x, z);
    const hc = c.heightAt(x, z);
    assert.ok(Number.isFinite(ha) && Number.isFinite(hc), 'height must be finite');
    maxDiff = Math.max(maxDiff, Math.abs(ha - hb));
  }
  assert.equal(maxDiff, 0, 'same seed must produce identical heights');
});

test('spawn pocket is level across seeds', () => {
  for (const seed of [1, 2, 3, 100, 777]) {
    const t = new Terrain(seed);
    assert.ok(
      Math.abs(t.heightAt(0, 0)) < 0.05,
      `seed ${seed} spawn not level: ${t.heightAt(0, 0)}`
    );
  }
});

test('relief stays in a playable band across seeds', () => {
  for (const seed of [1, 2, 3, 100, 777, 424242]) {
    const t = new Terrain(seed);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() * 2 - 1) * 70;
      const z = (Math.random() * 2 - 1) * 70;
      const h = t.heightAt(x, z);
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
    assert.ok(Number.isFinite(min) && Number.isFinite(max));
    assert.ok(max - min < 12, `seed ${seed} relief too large: ${(max - min).toFixed(2)}`);
  }
});
