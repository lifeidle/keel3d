import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DustTrail } from '../src/blocks/fx/DustTrail';

/**
 * R91 — DustTrail (distance-gated puff emission).
 */

test('first call emits; then only after >= interval of travel', () => {
  const t = new DustTrail({ interval: 0.4, life: 1 });
  assert.equal(t.add(0, 0, 0, 0), true, 'first always emits');
  assert.equal(t.add(0.2, 0, 0.1, 0.1), false, '0.22u < 0.4 — gated');
  assert.equal(t.puffs.length, 1, 'still one puff');
  assert.equal(t.add(0.4, 0, 0, 0.2), true, '0.4u from last EMISSION — emits');
  assert.equal(t.puffs.length, 2, 'two puffs');
  // the gate window RESTARTS at each emission
  assert.equal(t.add(0.4 + 0.39, 0, 0, 0.3), false, '0.39 < 0.4 — gated');
});

test('prunes expired puffs; age is 0..1 over the lifetime', () => {
  const t = new DustTrail({ interval: 0.1, life: 1 });
  t.add(0, 0, 0, 0);
  t.add(0.5, 0, 0, 0.5);
  assert.equal(t.update(0.9), 2, 'none expired yet');
  assert.equal(t.update(1.0), 1, 'first puff expired exactly at born+life');
  const p = t.puffs[0];
  assert.ok(Math.abs(t.age(p, p.born + 0.5) - 0.5) < 1e-9, 'age mid-life 0.5');
  assert.equal(t.update(2.0), 0, 'all expired');
});

test('puff fields carry position + emission time + lifetime', () => {
  const t = new DustTrail({ interval: 0.1, life: 1.5 });
  t.add(3, 0.2, -7, 12.5);
  const p = t.puffs[0];
  assert.equal(p.x, 3);
  assert.equal(p.y, 0.2);
  assert.equal(p.z, -7);
  assert.equal(p.born, 12.5);
  assert.equal(p.life, 1.5);
});

test('clear resets puffs AND the gate', () => {
  const t = new DustTrail({ interval: 1 });
  t.add(0, 0, 0, 0);
  t.clear();
  assert.equal(t.puffs.length, 0, 'puffs cleared');
  assert.equal(t.add(0.1, 0, 0, 1), true, 'gate re-armed (first call emits)');
});

test('validation', () => {
  assert.throws(() => new DustTrail({ interval: 0 }), /interval/);
  assert.throws(() => new DustTrail({ interval: NaN }), /interval/);
  assert.throws(() => new DustTrail({ life: -1 }), /life/);
  const t = new DustTrail();
  assert.throws(() => t.add(NaN, 0, 0, 0), /x\/z/);
});
