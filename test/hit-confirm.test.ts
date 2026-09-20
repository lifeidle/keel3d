import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HitConfirm } from '../src/blocks/ui/HitConfirm';

/**
 * R86 — HitConfirm (hit/kill classification + flash + counters).
 */

test('register hit: kind, counter, flash at full strength', () => {
  const hc = new HitConfirm(0.14);
  hc.register('hit');
  assert.equal(hc.latest, 'hit');
  assert.equal(hc.hits, 1);
  assert.equal(hc.kills, 0);
  assert.equal(hc.flashValue, 1, 'flash restarts at 1');
  assert.equal(hc.active, true);
});

test('register kill overrides hit; restarts the flash', () => {
  const hc = new HitConfirm(0.14);
  hc.register('hit');
  hc.update(0.07); // half the window — flash decaying
  const mid = hc.flashValue;
  assert.ok(mid < 1, `flash decaying (got ${mid})`);
  hc.register('kill');
  assert.equal(hc.latest, 'kill', 'kill overrides');
  assert.equal(hc.flashValue, 1, 'flash restarted');
  assert.equal(hc.kills, 1);
  assert.equal(hc.hits, 1, 'both counters kept');
});

test('flash fades to 0 and the kind clears', () => {
  const hc = new HitConfirm(0.14);
  hc.register('kill');
  hc.update(0.14); // complete the window
  assert.equal(hc.flashValue, 0);
  assert.equal(hc.latest, null, 'kind cleared after fade-out');
  assert.equal(hc.active, false);
  // one more update keeps it idle (no re-latch)
  hc.update(0.05);
  assert.equal(hc.latest, null);
});

test('counters accumulate; reset zeros everything', () => {
  const hc = new HitConfirm(0.2);
  hc.register('hit');
  hc.register('hit');
  hc.register('kill');
  assert.equal(hc.hits, 2);
  assert.equal(hc.kills, 1);
  hc.reset();
  assert.equal(hc.hits, 0);
  assert.equal(hc.kills, 0);
  assert.equal(hc.latest, null);
  assert.equal(hc.flashValue, 0);
  assert.throws(() => new HitConfirm(0), /duration/);
});
