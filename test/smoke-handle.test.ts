import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SmokeColumns } from '../src/blocks/fx/SmokeColumns';

/**
 * R94 — SmokeHandle.setStrength (dynamic column intensity).
 * update() reads puff height/baseScale/speed LIVE, so a rescaled column
 * responds on the next frame without re-creating puffs. Sprite scale after
 * an update is the observable: s = baseScale * (0.7 + k * 1.6) at phase k.
 */

function maxSpriteScale(sc: SmokeColumns, n: number): number {
  let m = 0;
  for (const child of sc.group.children) {
    const sp = child as unknown as { scale: { x: number; y: number; z: number } };
    if (sp.scale.x > m) m = sp.scale.x;
  }
  void n;
  return m;
}

test('addColumn returns a handle and adds 7 puffs to the group', () => {
  const sc = new SmokeColumns();
  const h = sc.addColumn(0, 0, 0, 1);
  assert.equal(typeof h.setStrength, 'function', 'handle exposes setStrength');
  assert.equal(sc.group.children.length, 7, '7 puffs');
});

test('setStrength rescales the column live (next update reflects it)', () => {
  const sc = new SmokeColumns();
  const h = sc.addColumn(0, 0, 0, 0.5);
  sc.update(0.1);
  const low = maxSpriteScale(sc, 7);
  h.setStrength(1.5);
  sc.update(0.1);
  const high = maxSpriteScale(sc, 7);
  assert.ok(high > low, `1.5x column scales bigger (low ${low} → high ${high})`);
});

test('strength is monotonic across repeated calls', () => {
  const sc = new SmokeColumns();
  const h = sc.addColumn(0, 0, 0, 0.5);
  const scales: number[] = [];
  for (const s of [0.4, 0.8, 1.2, 1.6]) {
    h.setStrength(s);
    sc.update(0.05);
    scales.push(maxSpriteScale(sc, 7));
  }
  for (let i = 1; i < scales.length; i++) {
    assert.ok(scales[i] >= scales[i - 1] - 1e-9,
      `monotonic non-decreasing: ${scales.map((v) => v.toFixed(3)).join(', ')}`);
  }
});

test('columns are independent (rescaling one leaves the other)', () => {
  const sc = new SmokeColumns();
  const h1 = sc.addColumn(0, 0, 0, 0.5);
  const h2 = sc.addColumn(5, 0, 0, 0.5);
  assert.equal(sc.group.children.length, 14, 'two columns');
  h1.setStrength(2);
  sc.update(0.05);
  // the second column's puffs (children 7..13) stay at the 0.5x envelope:
  // their max scale ≈ 0.5 * fScale(<=1.9) * (0.7..2.3) <= ~2.2
  let max2 = 0;
  const kids = sc.group.children;
  for (let i = 7; i < 14; i++) {
    const sp = kids[i] as unknown as { scale: { x: number } };
    if (sp.scale.x > max2) max2 = sp.scale.x;
  }
  assert.ok(max2 < 3, `column 2 unaffected (max ${max2.toFixed(2)})`);
});

test('validation: strength must be finite and > 0', () => {
  const sc = new SmokeColumns();
  assert.throws(() => sc.addColumn(0, 0, 0, 0), /strength/);
  assert.throws(() => sc.addColumn(0, 0, 0, NaN), /strength/);
  assert.throws(() => sc.addColumn(0, 0, 0, -1), /strength/);
  const h = sc.addColumn(0, 0, 0, 1);
  assert.throws(() => h.setStrength(0), /setStrength/);
  assert.throws(() => h.setStrength(NaN), /setStrength/);
});
