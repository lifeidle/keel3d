import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mixHex,
  brighten,
  lift,
  tint,
  luminance,
} from '../src/blocks/scene/ColorTone';

/**
 * ColorTone — pure colour/tone ops (R52). Headless.
 */

test('mixHex: t=0 → a, t=1 → b, t clamped outside [0,1]', () => {
  assert.equal(mixHex(0x000000, 0xffffff, 0), 0x000000);
  assert.equal(mixHex(0x000000, 0xffffff, 1), 0xffffff);
  assert.equal(mixHex(0x000000, 0xffffff, -5), 0x000000);
  assert.equal(mixHex(0x000000, 0xffffff, 5), 0xffffff);
});

test('mixHex: midpoint is the channel average', () => {
  const m = mixHex(0x102030, 0x405060, 0.5);
  assert.equal(m, 0x283848); // channel averages: 0x28 / 0x38 / 0x48
});

test('brighten: k=1 identity, k>1 brightens, k<1 darkens, clamped at 255', () => {
  assert.equal(brighten(0x102030, 1), 0x102030);
  const up = brighten(0x102030, 2);
  assert.ok(luminance(up) > luminance(0x102030), 'brighter');
  const down = brighten(0x102030, 0.5);
  assert.ok(luminance(down) < luminance(0x102030), 'darker');
  assert.equal(brighten(0xffffff, 3), 0xffffff, 'clamps at white');
});

test('lift / tint: mix toward white / toward a tint', () => {
  assert.equal(lift(0x000000, 0.5), mixHex(0x000000, 0xffffff, 0.5));
  assert.ok(luminance(lift(0x1c2418, 0.4)) > luminance(0x1c2418), 'lifted');
  assert.equal(tint(0xffffff, 0x0000ff, 1), 0x0000ff);
  assert.equal(tint(0x000000, 0x0000ff, 0), 0x000000);
});

test('luminance: black 0, white 1, grey in between, monotonic per-channel', () => {
  assert.equal(luminance(0x000000), 0);
  assert.equal(luminance(0xffffff), 1);
  const mid = luminance(0x808080);
  assert.ok(mid > 0.45 && mid < 0.56, `mid ${mid}`);
  // green weighs most in BT.709 → brighter than red at the same level
  assert.ok(luminance(0x008000) > luminance(0x800000), 'green > red (BT.709)');
});
