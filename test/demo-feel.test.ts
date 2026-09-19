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

// R69: sustained tint — ramp in/out linearly, on its own overlay channel.
function fakeEl(): { style: Record<string, string> } {
  return { style: {} };
}

test('sustain ramps in linearly and holds at 1', () => {
  const f = new GameFeel({ flash: null, tint: null });
  f.setSustain(true, 'rgba(255,40,40,0.55)', 0.5);
  f.update(0.25);
  assert.ok(Math.abs(f.sustainLevel - 0.5) < 0.01, `half ramp (got ${f.sustainLevel})`);
  f.update(0.25);
  assert.equal(f.sustainLevel, 1);
  f.update(10); // stays clamped
  assert.equal(f.sustainLevel, 1);
});

test('sustain ramps back to 0 after setSustain(false)', () => {
  const f = new GameFeel({ flash: null, tint: null });
  f.setSustain(true, undefined, 0.5);
  f.update(10); // fully on
  f.setSustain(false, undefined, 0.5);
  f.update(0.25);
  assert.ok(Math.abs(f.sustainLevel - 0.5) < 0.01, `half out (got ${f.sustainLevel})`);
  f.update(10);
  assert.equal(f.sustainLevel, 0);
});

test('sustain writes the tint element opacity + background; flash channel untouched', () => {
  const flash = fakeEl();
  const tint = fakeEl();
  const f = new GameFeel({ flash, tint });
  f.setSustain(true, 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(255,30,30,0.55) 100%)', 0.2);
  f.update(0.2);
  assert.equal(tint.style.opacity, '1');
  assert.ok(tint.style.background.includes('radial-gradient'), 'tint uses the gradient css');
  // a one-shot flash does NOT disturb the sustain channel
  f.flashOnce('rgba(255,80,80,0.35)');
  f.update(0.05);
  assert.equal(tint.style.opacity, '1');
  assert.ok(flash.style.background.includes('rgba(255,80,80,0.35)'));
});

test('headless default constructor: sustain logic runs without DOM', () => {
  const f = new GameFeel(); // no host, no document → null channels
  f.setSustain(true, undefined, 0.1);
  f.update(0.05);
  assert.equal(f.sustainLevel, 0.5);
  f.update(0.05);
  assert.equal(f.sustainLevel, 1);
});
