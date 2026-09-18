import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shadeHeightfield,
  domeHeightField,
} from '../src/blocks/scene/TerrainBuilder';

/**
 * shadeHeightfield — heightfield → RGBA buffer (pure, headless).
 * Verifies the north-fixed mapping (canvas up = world −z), the low→high
 * colour ramp, slope darkening, and clamping.
 */

const rgb = (buf: Uint8ClampedArray, size: number, px: number, py: number) => [
  buf[(py * size + px) * 4],
  buf[(py * size + px) * 4 + 1],
  buf[(py * size + px) * 4 + 2],
] as const;

test('flat field → uniform low colour + requested alpha', () => {
  const buf = shadeHeightfield({
    size: 8,
    extent: 40,
    heightAt: () => 0,
    low: [10, 14, 20],
    high: [96, 128, 160],
    alpha: 200,
  });
  assert.equal(buf.length, 8 * 8 * 4);
  assert.deepEqual(rgb(buf, 8, 4, 4), [10, 14, 20]);
  assert.equal(buf[(4 * 8 + 4) * 4 + 3], 200);
});

test('dome field: centre brighter than edge', () => {
  const h = domeHeightField({ domes: [{ x: 0, z: 0, h: 4, sigma: 10 }] });
  const buf = shadeHeightfield({
    size: 32,
    extent: 40,
    heightAt: h,
    low: [10, 14, 20],
    high: [96, 128, 160],
    slope: 0,
  });
  const center = rgb(buf, 32, 16, 16);
  const edge = rgb(buf, 32, 1, 16);
  const lum = (c: readonly number[]) => c[0] + c[1] + c[2];
  assert.ok(lum(center) > lum(edge) + 10, `center ${center} vs edge ${edge}`);
});

test('brightness increases with height (ramp field, monotonic left→right)', () => {
  const buf = shadeHeightfield({
    size: 32,
    extent: 40,
    heightAt: (x) => x,
    low: [0, 0, 0],
    high: [255, 255, 255],
    slope: 0,
    maxH: 40,
  });
  const left = rgb(buf, 32, 4, 16)[0]; // world x ≈ −28 → t clamped 0
  const mid = rgb(buf, 32, 16, 16)[0]; // world x ≈ 1.25 → small t
  const right = rgb(buf, 32, 28, 16)[0]; // world x ≈ 31 → large t
  assert.ok(left < mid, `${left} < ${mid}`);
  assert.ok(mid < right, `${mid} < ${right}`);
});

test('north-fixed mapping: a height at world −z lands in the canvas top half', () => {
  const buf = shadeHeightfield({
    size: 32,
    extent: 40,
    heightAt: (x, z) => (Math.abs(z + 20) < 2 && Math.abs(x) < 2 ? 4 : 0),
    low: [0, 0, 0],
    high: [255, 255, 255],
    slope: 0,
    maxH: 4,
  });
  const north = rgb(buf, 32, 16, 8)[0]; // world z ≈ −18.75
  const south = rgb(buf, 32, 16, 24)[0]; // world z ≈ +21.25
  assert.ok(north > 200, `north pixel ${north}`);
  assert.equal(south, 0, `south pixel ${south}`);
});

test('slope darkens the shadow side relative to a flat-shaded field', () => {
  const common = {
    size: 32,
    extent: 40,
    heightAt: (x: number, z: number) => z,
    low: [0, 0, 0] as [number, number, number],
    high: [255, 255, 255] as [number, number, number],
    maxH: 40,
  };
  const flat = shadeHeightfield({ ...common, slope: 0 });
  const shaded = shadeHeightfield({ ...common, slope: 3 });
  const a = rgb(flat, 32, 16, 16)[0];
  const b = rgb(shaded, 32, 16, 16)[0];
  assert.ok(b < a, `with-slope ${b} < no-slope ${a}`);
});

test('maxH normalization: identical field, different maxH → different scale', () => {
  const field = (maxH: number) =>
    shadeHeightfield({
      size: 32,
      extent: 40,
      heightAt: (x) => Math.max(0, 4 - Math.abs(x)),
      low: [0, 0, 0],
      high: [255, 255, 255],
      slope: 0,
      maxH,
    });
  const big = field(4); // peak normalizes to 1
  const small = field(8); // peak is only 0.5
  assert.ok(
    rgb(big, 32, 16, 16)[0] > rgb(small, 32, 16, 16)[0],
    'same field at a smaller maxH renders brighter',
  );
});
