import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectToScreen, type CamLike } from '../src/blocks/math/Projection';

/**
 * Projection — pure math tests. Identity camera at the origin looks down -Z
 * (three.js convention); fov 90° gives focalY = 1, keeping hand-checks exact.
 */

const CAM: CamLike = {
  position: { x: 0, y: 0, z: 0 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 },
  fov: 90,
  aspect: 16 / 9,
};

const W = 1600;
const H = 900;

test('point 10 ahead of an identity camera projects to the centre', () => {
  const p = projectToScreen({ x: 0, y: 0, z: -10 }, CAM, W, H);
  assert.ok(p.visible, 'in front of the camera');
  assert.ok(Math.abs(p.x - W / 2) < 1e-6, `x ${p.x}`);
  assert.ok(Math.abs(p.y - H / 2) < 1e-6, `y ${p.y}`);
  assert.ok(Math.abs(p.dist - 10) < 1e-6, `dist ${p.dist}`);
});

test('point behind the camera is invisible', () => {
  const p = projectToScreen({ x: 0, y: 0, z: 10 }, CAM, W, H);
  assert.ok(!p.visible, 'behind → invisible');
  const p2 = projectToScreen({ x: 5, y: 5, z: 0.01 }, CAM, W, H);
  assert.ok(!p2.visible, 'at the camera plane → invisible');
});

test('point to the right projects to the right half (aspect-scaled)', () => {
  // fov 90, aspect 16/9: at depth 10 the visible half-width is 10*16/9 ≈ 17.8
  const p = projectToScreen({ x: 10, y: 0, z: -10 }, CAM, W, H);
  assert.ok(p.visible);
  assert.ok(p.x > W / 2, `x ${p.x} should be right of centre`);
  assert.ok(Math.abs(p.y - H / 2) < 1e-6, 'still vertically centred');
  // exact: ndcX = (10/10)/ (16/9) = 9/16 → x = (1 + 9/16)/2 * W
  const expectedX = ((1 + 9 / 16) / 2) * W;
  assert.ok(Math.abs(p.x - expectedX) < 1e-6, `x ${p.x} vs ${expectedX}`);
});

test('point above the camera projects to the top edge at fov 90', () => {
  const p = projectToScreen({ x: 0, y: 10, z: -10 }, CAM, W, H);
  assert.ok(p.visible);
  assert.ok(Math.abs(p.x - W / 2) < 1e-6);
  assert.ok(p.y < H * 0.1, `y ${p.y} near the top`);
  // exact: ndcY = 1 → y = 0
  assert.ok(Math.abs(p.y) < 1e-6, `y ${p.y}`);
});

test('yawed camera (90° about Y) sees -X ahead and -Z to its right', () => {
  const cy = Math.SQRT1_2; // cos45 = sin45
  const yawCam: CamLike = {
    position: { x: 0, y: 0, z: 0 },
    quaternion: { x: 0, y: cy, z: 0, w: cy },
    fov: 90,
    aspect: 1,
  };
  const ahead = projectToScreen({ x: -10, y: 0, z: 0 }, yawCam, 100, 100);
  assert.ok(ahead.visible, '-X is now the forward direction');
  assert.ok(Math.abs(ahead.x - 50) < 1e-6 && Math.abs(ahead.y - 50) < 1e-6, 'centred');
  // "right" must also be ahead: 5 units right (-Z) + 10 ahead (-X)
  const right = projectToScreen({ x: -10, y: 0, z: -5 }, yawCam, 100, 100);
  assert.ok(right.visible, 'ahead-right point is in front');
  assert.ok(right.x > 50, `x ${right.x} right of centre`);
  assert.ok(Math.abs(right.y - 50) < 1e-6, 'horizon stays level');
  // a point purely to the side (camera plane) is invisible
  const side = projectToScreen({ x: 0, y: 0, z: -10 }, yawCam, 100, 100);
  assert.ok(!side.visible, 'on the camera plane → invisible');
});

test('narrower fov zooms in (same point moves AWAY from centre)', () => {
  const wide = projectToScreen({ x: 5, y: 0, z: -10 }, { ...CAM, fov: 90 }, W, H);
  const narrow = projectToScreen({ x: 5, y: 0, z: -10 }, { ...CAM, fov: 45 }, W, H);
  assert.ok(narrow.x > wide.x, `narrower fov → farther out (${narrow.x} vs ${wide.x})`);
  assert.ok(narrow.visible && wide.visible);
});
