import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WindowBar } from '../src/blocks/ui/WindowBar';

/**
 * WindowBar — rolling-window remaining-time bar (R72).
 */

test('fraction drains linearly from 1 to 0 over the window', () => {
  const w = new WindowBar({ window: 4 });
  assert.equal(w.fractionAt(0), 0, 'idle before any mark');
  w.mark(0);
  assert.equal(w.fractionAt(0), 1, 'full right after mark');
  assert.ok(Math.abs(w.fractionAt(2) - 0.5) < 1e-9, 'half at t=2');
  assert.equal(w.fractionAt(4), 0, 'zero at expiry');
  assert.equal(w.fractionAt(9), 0, 'stays zero after');
});

test('re-mark restarts the window (latest event wins)', () => {
  const w = new WindowBar({ window: 4 });
  w.mark(0);
  w.update(3.5); // 0.125 left
  w.mark(3.5); // refill
  assert.ok(Math.abs(w.fractionAt(4) - 0.875) < 1e-9, 'refilled window');
  assert.equal(w.fractionAt(7.5), 0, 'expires at mark+window');
});

test('update drives the DOM width as a rounded percentage', () => {
  const el = { style: {} as Record<string, string> };
  const w = new WindowBar({ window: 4, el: el as never });
  w.mark(0);
  w.update(1);
  assert.equal(el.style.width, '75%');
  w.update(3.99);
  assert.equal(el.style.width, '0%');
  // idle → 0% (no NaN, no churn)
  const w2 = new WindowBar({ window: 4, el: el as never });
  w2.update(10);
  assert.equal(el.style.width, '0%');
});

test('fraction is monotone between marks; invalid window throws', () => {
  const w = new WindowBar({ window: 4 });
  w.mark(0);
  let prev = Infinity;
  for (const t of [0.3, 1.1, 2.7, 3.99]) {
    const f = w.fractionAt(t);
    assert.ok(f <= prev, `monotone at ${t}`);
    prev = f;
  }
  assert.throws(() => new WindowBar({ window: 0 }));
  assert.throws(() => new WindowBar({ window: -1 }));
  assert.throws(() => new WindowBar({ window: NaN }));
});
