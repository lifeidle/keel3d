import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PauseMenu } from '../src/blocks/ui/PauseMenu';
import { ControlsOverlay } from '../src/blocks/ui/ControlsOverlay';
import { isTouchDevice } from '../src/ui/touch';

test('PauseMenu starts running and toggles', () => {
  const p = new PauseMenu({ title: 'T' });
  assert.equal(p.paused, false);
  p.pause();
  assert.equal(p.paused, true);
  p.pause(); // idempotent
  assert.equal(p.paused, true);
  p.resume();
  assert.equal(p.paused, false);
  p.toggle();
  assert.equal(p.paused, true);
  p.toggle();
  assert.equal(p.paused, false);
  p.dispose();
});

test('PauseMenu honours the active gate', () => {
  let canPause = false;
  const p = new PauseMenu({ active: () => canPause });
  p.pause();
  assert.equal(p.paused, false, 'gated pause must be refused');
  canPause = true;
  p.pause();
  assert.equal(p.paused, true);
  p.dispose();
});

test('PauseMenu reports toggles to onToggle', () => {
  const seen: boolean[] = [];
  const p = new PauseMenu({ onToggle: (v) => seen.push(v) });
  p.pause();
  p.resume();
  assert.deepEqual(seen, [true, false]);
  p.dispose();
});

test('PauseMenu system is safe without DOM', () => {
  const p = new PauseMenu();
  assert.equal(typeof p.system.name, 'string');
  p.system.update?.(0.016, {} as never);
  p.system.dispose?.();
  p.dispose(); // second dispose is a no-op
});

test('ControlsOverlay auto-hide timer tolerates a missing DOM', () => {
  const c = new ControlsOverlay({ hints: [], duration: 2 });
  c.show();
  c.system.update?.(1, {} as never);
  c.system.update?.(5, {} as never);
  assert.equal(c.shown, false, 'without a document there is nothing to display');
  c.dispose();
});

test('ControlsOverlay is safe without DOM', () => {
  const c = new ControlsOverlay({
    hints: [{ keys: ['W'], label: '移动' }],
    footer: '桌面设备体验更佳',
  });
  assert.equal(c.shown, false, 'no document -> nothing to show');
  c.show();
  c.hide();
  c.system.update?.(0.016, {} as never);
  c.dispose();
  c.dispose();
});

test('isTouchDevice is false outside a browser (re-exported via ui/touch)', () => {
  assert.equal(isTouchDevice(), false);
});
