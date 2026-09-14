import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BossBar } from '../src/blocks/ui/BossBar';
import { Countdown } from '../src/blocks/ui/Countdown';
import { GameFeel } from '../src/blocks/fx/GameFeel';

test('BossBar safe without DOM', () => {
  const b = new BossBar();
  b.show('X');
  b.setHp(50, 100);
  b.hide();
  b.dispose();
  assert.equal(b.el, null);
});

test('Countdown ticks down and flags done', () => {
  const c = new Countdown({ seconds: 2 });
  c.start(1);
  assert.equal(c.done, false);
  c.update(0.6);
  assert.ok(c.secondsLeft <= 1);
  c.update(0.5);
  assert.equal(c.done, true);
  c.dispose();
});

test('GameFeel flash/shake safe without DOM', () => {
  const f = new GameFeel();
  f.flashOnce();
  f.shake(0.2, 0.2);
  const off = f.update(0.05);
  assert.ok(typeof off.x === 'number');
  f.dispose();
});
