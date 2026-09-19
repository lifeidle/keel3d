import { test } from 'node:test';
import assert from 'assert/strict';
import { Ambience } from '../src/blocks/audio/Ambience';

/**
 * Ambience — randomized-interval scheduler (pure, headless).
 */

test('fixed random 0 → fires after the minimum interval', () => {
  let fired = 0;
  const a = new Ambience({
    minInterval: 6,
    maxInterval: 14,
    enabled: () => true,
    random: () => 0, // always the minimum
    onPlay: () => fired++,
  });
  a.update(5.9);
  assert.equal(fired, 0, 'not yet');
  a.update(0.2);
  assert.equal(fired, 1, 'fired at 6.1s');
  assert.equal(a.playCount, 1);
});

test('fixed random 1 → fires after the maximum interval', () => {
  let fired = 0;
  const a = new Ambience({
    minInterval: 6,
    maxInterval: 14,
    enabled: () => true,
    random: () => 1, // always the maximum
    onPlay: () => fired++,
  });
  a.update(13.9);
  assert.equal(fired, 0);
  a.update(0.2);
  assert.equal(fired, 1, 'fired at 14.1s');
});

test('gate closed: timer pauses (no run-down) and resumes after', () => {
  let fired = 0;
  let open = true;
  const a = new Ambience({
    minInterval: 5,
    maxInterval: 5,
    enabled: () => open,
    random: () => 0,
    onPlay: () => fired++,
  });
  a.update(4); // 1s left
  open = false;
  a.update(100); // gate closed: no run-down, no fire
  assert.equal(fired, 0, 'paused while gated');
  open = true;
  a.update(0.9);
  assert.equal(fired, 0, '0.9s of the remaining 1s');
  a.update(0.2);
  assert.equal(fired, 1, 'resumed where it paused (1.1s > 1s left)');
});

test('plays accumulate with re-picked intervals', () => {
  // cycle r through 0,1,0,1 → intervals 5,10,5,10...
  const seq = [0, 1, 0, 1];
  let i = 0;
  const a = new Ambience({
    minInterval: 5,
    maxInterval: 10,
    enabled: () => true,
    random: () => seq[i++ % seq.length],
  });
  const t0 = a.playCount;
  a.update(5); // first pick r=0 → 5
  assert.equal(a.playCount, t0 + 1);
  a.update(10); // second pick r=1 → 10
  assert.equal(a.playCount, t0 + 2);
  a.update(14); // third pick r=0 → 5 (fires) then 10 (not yet)
  assert.equal(a.playCount, t0 + 3);
});

test('invalid config throws; reset re-arms', () => {
  assert.throws(() => new Ambience({ minInterval: 0, maxInterval: 5, enabled: () => true }));
  assert.throws(() => new Ambience({ minInterval: 7, maxInterval: 5, enabled: () => true }));
  let fired = 0;
  const a = new Ambience({
    minInterval: 1,
    maxInterval: 1,
    enabled: () => true,
    onPlay: () => fired++,
  });
  a.update(1.5);
  assert.equal(a.playCount, 1);
  a.reset();
  assert.equal(a.playCount, 0, 'counter reset');
  a.update(1.5);
  assert.equal(fired, 2, 'still fires after reset');
});
