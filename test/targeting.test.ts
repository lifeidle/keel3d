import { test } from 'node:test';
import assert from 'assert/strict';
import { pickTarget } from '../src/blocks/combat/Targeting';

/**
 * Targeting.pickTarget — mode/range/alive/facing filters (pure, headless).
 */

const P = (x: number, z: number, extra: { alive?: boolean } = {}) => ({ x, z, ...extra });

test('mode nearest: closest alive entry wins (planar distance)', () => {
  const pool = [P(10, 0), P(3, 4), P(1, 1)];
  const t = pickTarget(0, 0, pool, undefined, { mode: 'nearest' });
  assert.deepEqual(t, P(1, 1));
});

test('mode nearest skips dead entries', () => {
  const pool = [P(1, 1, { alive: false }), P(5, 0)];
  const t = pickTarget(0, 0, pool);
  assert.deepEqual(t, P(5, 0), 'dead nearest is skipped');
});

test('empty / all-dead pool → null', () => {
  assert.equal(pickTarget(0, 0, []), null);
  assert.equal(pickTarget(0, 0, [P(1, 0, { alive: false })]), null);
});

test('range filter: entries beyond the range are ignored', () => {
  const pool = [P(10, 0), P(3, 0)];
  const t = pickTarget(0, 0, pool, undefined, { range: 5 });
  assert.deepEqual(t, P(3, 0));
  assert.equal(pickTarget(0, 0, [P(10, 0)], undefined, { range: 5 }), null);
});

test('mode lowestHp: lowest hp wins (distance breaks ties)', () => {
  const pool = [
    { x: 2, z: 0, hp: 5 },
    { x: 1, z: 0, hp: 9 },
  ];
  const t = pickTarget(0, 0, pool, (e) => e.hp, { mode: 'lowestHp' });
  assert.deepEqual(t, pool[0], 'hp 5 < hp 9 despite being farther');
  // equal hp → nearer wins (distance tie-break term)
  const pool2 = [
    { x: 9, z: 0, hp: 5 },
    { x: 1, z: 0, hp: 5 },
  ];
  const t2 = pickTarget(0, 0, pool2, (e) => e.hp, { mode: 'lowestHp' });
  assert.deepEqual(t2, pool2[1], 'tie on hp → nearer');
});

test('mode first: earliest alive entry wins', () => {
  const pool = [P(9, 0), P(1, 0)];
  const t = pickTarget(0, 0, pool, undefined, { mode: 'first' });
  assert.deepEqual(t, pool[0], 'even though pool[1] is nearer');
});

test('facing filter: only entries within the facing cone pass', () => {
  // facing +z (0,1); a target at +x (dot 0) is out of a minDot 0.5 cone
  const pool = [P(9, 0), P(0, 9)];
  const t = pickTarget(0, 0, pool, undefined, {
    mode: 'nearest',
    facingX: 0,
    facingZ: 1,
    minDot: 0.5,
  });
  assert.deepEqual(t, P(0, 9), 'sideways target filtered out');
});
