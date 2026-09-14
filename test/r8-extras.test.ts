import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BeatClock } from '../src/blocks/audio/BeatClock';
import { VoxelChunk } from '../src/blocks/world/VoxelChunk';
import { ShrinkZone } from '../src/blocks/gameplay/ShrinkZone';

test('BeatClock advances and judges windows', () => {
  const c = new BeatClock({ bpm: 120, perfectWindow: 0.05, goodWindow: 0.12 });
  assert.ok(Math.abs(c.beatDuration - 0.5) < 1e-9);
  c.update(0.01);
  assert.equal(c.judge(), 'perfect');
  c.update(0.06); // t=0.07 → good
  assert.equal(c.judge(), 'good');
  c.update(0.2); // t=0.27 → miss
  assert.equal(c.judge(), 'miss');
});

test('VoxelChunk set/get/remove/inBounds', () => {
  const v = new VoxelChunk({ size: 8 });
  assert.ok(v.set(0, 0, 0, 3));
  assert.equal(v.get(0, 0, 0), 3);
  assert.equal(v.count, 1);
  assert.ok(v.remove(0, 0, 0));
  assert.equal(v.count, 0);
  assert.equal(v.set(50, 0, 0, 1), false);
});

test('ShrinkZone contains and shrinks', () => {
  const z = new ShrinkZone({ radius: 20, minRadius: 5, rate: 10, delay: 0.1 });
  assert.ok(z.contains(0, 0));
  assert.equal(z.contains(30, 0), false);
  z.shrinkStep(10);
  z.update(2);
  assert.ok(z.radius < 20);
});
