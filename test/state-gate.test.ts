import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateGate, gateStyle } from '../src/blocks/ui/StateGate';

/**
 * R82 — StateGate (conditional element visibility).
 */

test('gateStyle: defaults on/off', () => {
  assert.equal(gateStyle(true), '1');
  assert.equal(gateStyle(false), '0');
});

test('gateStyle: custom on/off values', () => {
  assert.equal(gateStyle(true, { on: 'block', off: 'none' }), 'block');
  assert.equal(gateStyle(false, { on: 'block', off: 'none' }), 'none');
  assert.equal(gateStyle(true, { off: 'hidden' }), '1', 'off does not affect active');
});

test('StateGate: headless-safe (null element — set tracks state, no throw)', () => {
  const g = new StateGate(null);
  g.set(true);
  assert.equal(g.visible, true);
  g.set(false);
  assert.equal(g.visible, false);
  g.dispose();
});

test('StateGate: DOM — drives el.style[prop] on set', () => {
  if (typeof document === 'undefined') return; // headless env — skip DOM part
  const el = document.createElement('div');
  const g = new StateGate(el);
  assert.equal(el.style.opacity, '0', 'constructed hidden (inactive default)');
  g.set(true);
  assert.equal(el.style.opacity, '1');
  g.set(false);
  assert.equal(el.style.opacity, '0');
  g.dispose();
});

test('StateGate: custom property (display block/none)', () => {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  const g = new StateGate(el, { prop: 'display', on: 'block', off: 'none' });
  assert.equal(el.style.display, 'none');
  g.set(true);
  assert.equal(el.style.display, 'block');
  g.set(false);
  assert.equal(el.style.display, 'none');
  g.dispose();
});
