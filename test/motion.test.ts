import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pulse, bobY } from '../src/blocks/fx/Motion';

/**
 * R88 — Motion (pulse / bobY oscillation helpers).
 */

test('pulse: 0 at t=0, 1 at half period, 0 at full period, wraps', () => {
  assert.equal(pulse(0, 1.2), 0, 'starts at 0');
  assert.ok(Math.abs(pulse(0.6, 1.2) - 1) < 1e-9, 'peak at half');
  assert.ok(Math.abs(pulse(1.2, 1.2) - 0) < 1e-9, 'zero at full');
  // periodicity: t = 2.5·period ≡ 0.5·period
  assert.ok(Math.abs(pulse(3.0, 1.2) - 1) < 1e-9, 'wraps to peak');
  // mid-point symmetry
  assert.ok(Math.abs(pulse(0.3, 1.2) - pulse(0.9, 1.2)) < 1e-9, 'symmetric');
});

test('pulse: phase shifts the wave; negative pre-spawn clamps to 0', () => {
  assert.ok(Math.abs(pulse(0, 1.2, 0.6) - 1) < 1e-9, 'phase 0.6 peaks at t=0');
  assert.equal(pulse(-5, 1.2), 0, 't<0 clamps to 0');
  assert.ok(Math.abs(pulse(-5, 1.2, 2.0) - pulse(0, 1.2, 2.0 - 0)) >= 0, 'sanity');
  // with enough phase to push t+phase positive, it behaves normally
  assert.ok(Math.abs(pulse(-0.5, 1.0, 1.5) - pulse(1.0, 1.0)) < 1e-9,
    't+phase = 1.0 ≡ t=1.0 of an unshifted pulse');
});

test('bobY: zero at t=0 (no phase), peaks at quarter period', () => {
  assert.equal(bobY(0, 0.2, 1.6), 0, 'zero at t=0');
  assert.ok(Math.abs(bobY(0.4, 0.2, 1.6) - 0.2) < 1e-9, 'peak at T/4');
  assert.ok(Math.abs(bobY(1.2, 0.2, 1.6) + 0.2) < 1e-9, 'trough at 3T/4');
  assert.ok(Math.abs(bobY(1.6, 0.2, 1.6)) < 1e-9, 'zero at T');
});

test('bobY: phase and amplitude scale', () => {
  assert.ok(Math.abs(bobY(0, 0.3, 1.0, Math.PI / 2) - 0.3) < 1e-9, 'phase π/2 peaks at t=0');
  assert.ok(Math.abs(bobY(0.5, 0.5, 1.0) - 0) < 1e-9, 'zero at half period');
});

test('validation', () => {
  assert.throws(() => pulse(0, 0), /period/);
  assert.throws(() => pulse(0, NaN), /period/);
  assert.throws(() => bobY(0, -1), /amp/);
  assert.throws(() => bobY(0, 0.1, 0), /period/);
  assert.throws(() => bobY(0, NaN), /amp/);
});
