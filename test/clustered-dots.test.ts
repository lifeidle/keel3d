import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spreadDots, type SpreadPoint } from '../src/blocks/ui/ClusteredDots';

/**
 * R101 — spreadDots (overlapping clusters → ring layout, deterministic).
 */

test('well-separated points are unchanged', () => {
  const pts: SpreadPoint[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
  ];
  const out = spreadDots(pts, 2, 1);
  assert.deepEqual(out, pts, 'no cluster under 2u → identical');
});

test('a two-point cluster spreads onto the ring, deterministic order', () => {
  const pts: SpreadPoint[] = [
    { x: -0.4, y: 0 },
    { x: 0.4, y: 0 },
  ];
  const out = spreadDots(pts, 2, 1);
  // centroid (0,0); members ordered by x → left point (smaller x) takes
  // k=0 → ring "up" (0,+1); right point k=1 → "down" (0,-1).
  assert.ok(Math.hypot(out[0].x, out[0].y) > 0.99, `member 1 on ring (${JSON.stringify(out[0])})`);
  assert.ok(Math.hypot(out[1].x, out[1].y) > 0.99, 'member 2 on ring');
  assert.ok(out[0].y > 0.9, `left member maps up (${out[0].y})`);
  assert.ok(out[1].y < -0.9, `right member maps down (${out[1].y})`);
});

test('three-point cluster → 120° ring, deterministic across calls', () => {
  const pts: SpreadPoint[] = [
    { x: 0.2, y: 0.1 },
    { x: -0.2, y: -0.1 },
    { x: 0, y: 0.3 },
  ];
  const a = spreadDots(pts, 1, 0.8);
  const b = spreadDots(pts, 1, 0.8);
  assert.deepEqual(a, b, 'same input → same output');
  const dist = (p: SpreadPoint, q: SpreadPoint) => Math.hypot(p.x - q.x, p.y - q.y);
  assert.ok(dist(a[0], a[1]) > 1.2, 'pairwise separated');
  assert.ok(dist(a[1], a[2]) > 1.2, 'pairwise separated');
});

test('a single point among clusters is untouched', () => {
  const pts: SpreadPoint[] = [
    { x: 0, y: 0 },
    { x: 0.3, y: 0 },
    { x: 50, y: 50 },
  ];
  const out = spreadDots(pts, 1, 0.6);
  assert.deepEqual(out[2], { x: 50, y: 50 }, 'isolated point unchanged');
  assert.ok(Math.hypot(out[0].x, out[0].y) > 0.5, 'cluster member moved');
});

test('validation', () => {
  assert.throws(() => spreadDots([], 0, 1), /clusterR/);
  assert.throws(() => spreadDots([], 1, -1), /ringR/);
  assert.throws(() => spreadDots([{ x: NaN, y: 0 }], 1, 1), /finite/);
});
