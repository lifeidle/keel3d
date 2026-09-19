import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PingMarker } from '../src/blocks/ui/PingMarker';

/**
 * R81 — PingMarker tag support (content identity for render dispatch).
 */

test('ping: number life back-compat (no tag)', () => {
  const pm = new PingMarker();
  pm.ping(1, 2, 0, 4);
  const s = pm.active(1);
  assert.equal(s.length, 1);
  assert.equal(s[0].tag, undefined);
  assert.equal(s[0].fraction, 0.75);
});

test('ping: opts life + tag carried into samples', () => {
  const pm = new PingMarker();
  pm.ping(5, -5, 0, { life: 5, tag: 'ally' });
  const s = pm.active(2.5);
  assert.equal(s.length, 1);
  assert.equal(s[0].tag, 'ally');
  assert.equal(s[0].fraction, 0.5);
});

test('ping: mixed tags coexist, sorted by fraction (oldest first)', () => {
  const pm = new PingMarker();
  pm.ping(0, 0, 0, { life: 2, tag: 'wave' }); // 50% left at t=1
  pm.ping(3, 3, 0, { life: 4, tag: 'ally' }); // 75% left at t=1
  const s = pm.active(1);
  assert.deepEqual(s.map((p) => p.tag), ['wave', 'ally'], 'lowest fraction first');
});

test('ping: opts lifecycle — default life 3, invalid life throws, expiry prunes', () => {
  const pm = new PingMarker();
  pm.ping(0, 0, 0, { tag: 'ally' }); // default life 3
  assert.equal(pm.active(2.9).length, 1);
  assert.equal(pm.active(3.1).length, 0, 'expired at 3.1 (pruned)');
  assert.throws(() => pm.ping(0, 0, 0, { life: -1 }), /life/);
  assert.throws(() => pm.ping(0, 0, 0, -2), /life/);
});
