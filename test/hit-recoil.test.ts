import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HitRecoil } from '../src/blocks/kit/HitRecoil';

/**
 * HitRecoil — hit flinch / recoil presentation (pure, headless).
 */

const target = () => ({ position: { z: 0 }, rotation: { x: 0 } });

test('idle: no flinch, pivot stays zero', () => {
  const r = new HitRecoil(0.16, 0.24, 0.22);
  const p = target();
  r.update(0.016, p);
  assert.equal(p.position.z, 0);
  assert.equal(p.rotation.x, 0);
  assert.equal(r.active, false);
});

test('flinch applies the full pose immediately (frame with dt=0)', () => {
  const r = new HitRecoil(0.16, 0.24, 0.22);
  const p = target();
  r.flinch();
  r.update(0, p);
  assert.ok(Math.abs(p.position.z - 0.16) < 1e-9);
  assert.ok(Math.abs(p.rotation.x - 0.24) < 1e-9);
  assert.equal(r.strength, 1);
});

test('decays linearly; pose applies current strength, then snaps back', () => {
  const r = new HitRecoil(0.16, 0.24, 0.22);
  const p = target();
  r.flinch();
  r.update(0.11, p); // applies f=1 (full pose), then decays to 0.5
  assert.ok(Math.abs(r.strength - 0.5) < 1e-9, `strength ${r.strength}`);
  assert.ok(Math.abs(p.position.z - 0.16) < 1e-9, 'full pose this frame');
  r.update(0.11, p); // applies f=0.5 (half pose), then decays to 0
  assert.ok(Math.abs(p.position.z - 0.08) < 1e-9, 'half-strength pose next frame');
  assert.equal(r.strength, 0);
  r.update(0.016, p); // snap-back frame
  assert.equal(p.position.z, 0);
  assert.equal(p.rotation.x, 0);
});

test('retrigger mid-decay refreshes to full strength', () => {
  const r = new HitRecoil(0.16, 0.24, 0.22);
  const p = target();
  r.flinch();
  r.update(0.1, p);
  assert.ok(r.strength < 1);
  r.flinch();
  assert.equal(r.strength, 1);
  r.update(0, p);
  assert.ok(Math.abs(p.position.z - 0.16) < 1e-9, 'back to full pose');
});

test('multiple exact frames accumulate the decay to zero', () => {
  const r = new HitRecoil(1, 1, 1.0);
  const p = target();
  r.flinch();
  for (let i = 0; i < 3; i++) r.update(0.25, p); // exact binary fractions
  assert.ok(Math.abs(r.strength - 0.25) < 1e-9, `strength ${r.strength}`);
  r.update(0.25, p);
  assert.equal(r.strength, 0);
  r.update(0.25, p); // snap-back frame
  assert.equal(p.position.z, 0);
});

test('invalid flinchTime throws', () => {
  assert.throws(() => new HitRecoil(1, 1, 0));
  assert.throws(() => new HitRecoil(1, 1, NaN));
});
