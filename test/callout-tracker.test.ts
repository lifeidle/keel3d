import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CalloutTracker, type CalloutBank } from '../src/blocks/audio/CalloutTracker';

/**
 * CalloutTracker — per-key radio pacing + stats (R70).
 */

/** Fake voice bank: honours a per-key min-gap with an injectable clock. */
function fakeBank() {
  const lastPlay: Record<string, number> = {};
  const gaps: Record<string, number> = {};
  let clock = 0;
  let blockKeys: Record<string, boolean> = {};
  const bank: CalloutBank = {
    setMinGap(key, ms) {
      gaps[key] = ms;
    },
    playVoice(key, gain) {
      if (blockKeys[key]) return false;
      const now = clock;
      if (lastPlay[key] !== undefined && now - lastPlay[key] < (gaps[key] ?? 0)) return false;
      lastPlay[key] = now;
      return true;
    },
  };
  return {
    bank,
    gaps,
    advance(ms: number) {
      clock += ms;
    },
    block(key: string, on: boolean) {
      blockKeys[key] = on;
    },
  };
}

test('call forwards the gap to the bank, counts attempts/ok, sets last', () => {
  const f = fakeBank();
  const t = new CalloutTracker(f.bank);
  assert.equal(t.last, null);
  assert.equal(t.call({ key: 'a', gain: 0.9, gapMs: 6000 }), true);
  assert.equal(f.gaps.a, 6000, 'gap forwarded');
  assert.equal(t.last, 'a');
  assert.deepEqual(t.count('a'), { attempts: 1, ok: 1 });
  assert.equal(t.totalAttempts, 1);
  assert.equal(t.totalOk, 1);
});

test('a gap-blocked call still counts as an attempt (last = attempted key)', () => {
  const f = fakeBank();
  const t = new CalloutTracker(f.bank);
  t.call({ key: 'a', gain: 0.9, gapMs: 6000 }); // plays at t=0
  const r2 = t.call({ key: 'a', gain: 0.9, gapMs: 6000 }); // still inside the gap
  assert.equal(r2, false, 'bank refuses while inside the gap');
  assert.equal(t.last, 'a', 'last = last ATTEMPTED key');
  assert.deepEqual(t.count('a'), { attempts: 2, ok: 1 });
  f.advance(6001);
  assert.equal(t.call({ key: 'a', gain: 0.9, gapMs: 6000 }), true, 'gap open after advance');
  assert.deepEqual(t.count('a'), { attempts: 3, ok: 2 });
});

test('per-key counts are isolated; unknown key reads zeros', () => {
  const f = fakeBank();
  const t = new CalloutTracker(f.bank);
  t.call({ key: 'a', gain: 0.9, gapMs: 1000 });
  t.call({ key: 'b', gain: 0.8, gapMs: 2000 });
  assert.deepEqual(t.count('a'), { attempts: 1, ok: 1 });
  assert.deepEqual(t.count('b'), { attempts: 1, ok: 1 });
  assert.deepEqual(t.count('zzz'), { attempts: 0, ok: 0 });
  assert.equal(t.totalAttempts, 2);
  assert.equal(t.totalOk, 2);
  assert.equal(t.last, 'b');
});

test('content id: last/count track the id, the bank still gets the key', () => {
  const f = fakeBank();
  const t = new CalloutTracker(f.bank);
  assert.equal(t.call({ id: 'wave', key: 'radio_wave', gain: 0.95, gapMs: 6000 }), true);
  assert.equal(f.gaps.radio_wave, 6000, 'bank gap keyed by the BANK key');
  assert.equal(t.last, 'wave', 'last = content id');
  assert.deepEqual(t.count('wave'), { attempts: 1, ok: 1 }, 'count by id');
  assert.deepEqual(t.count('radio_wave'), { attempts: 0, ok: 0 });
  // gap still enforced by bank key — a second call inside the gap is refused
  assert.equal(t.call({ id: 'wave', key: 'radio_wave', gain: 0.95, gapMs: 6000 }), false);
  assert.deepEqual(t.count('wave'), { attempts: 2, ok: 1 });
});

test('a bank that refuses everything counts attempts but never ok', () => {
  const f = fakeBank();
  f.block('a', true);
  const t = new CalloutTracker(f.bank);
  assert.equal(t.call({ key: 'a', gain: 0.9, gapMs: 1000 }), false);
  assert.equal(t.call({ key: 'a', gain: 0.9, gapMs: 1000 }), false);
  assert.deepEqual(t.count('a'), { attempts: 2, ok: 0 });
  assert.equal(t.totalOk, 0);
  assert.equal(t.last, 'a');
});
