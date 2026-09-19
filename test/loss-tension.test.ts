import { test } from 'node:test';
import assert from 'assert/strict';
import { LossTension } from '../src/blocks/gameplay/LossTension';

/**
 * LossTension — decaying loss tension (pure, headless).
 */

test('note bumps to severity with max semantics (never lowers)', () => {
  const t = new LossTension(6);
  t.note(0.6);
  assert.ok(Math.abs(t.value - 0.6) < 1e-9, `value ${t.value}`);
  t.note(0.4); // lower severity: no change
  assert.ok(Math.abs(t.value - 0.6) < 1e-9);
  t.note(0.9);
  assert.ok(Math.abs(t.value - 0.9) < 1e-9);
});

test('decay halves toward the floor after one half-life', () => {
  const t = new LossTension(6);
  t.note(1);
  t.update(6);
  assert.ok(Math.abs(t.value - 0.5) < 1e-9, `value ${t.value}`);
  t.update(6);
  assert.ok(Math.abs(t.value - 0.25) < 1e-9, `value ${t.value}`);
});

test('floor: decays toward it, never below; update at floor is a no-op', () => {
  const t = new LossTension(4, 0.2);
  t.note(0.8);
  t.update(4); // (0.8 - 0.2) / 2 + 0.2 = 0.5
  assert.ok(Math.abs(t.value - 0.5) < 1e-9, `value ${t.value}`);
  t.update(1000);
  assert.ok(t.value >= 0.2 - 1e-9, `value ${t.value}`);
  assert.ok(t.value <= 0.2 + 1e-6, `value ${t.value}`);
  const v = t.value;
  t.update(10);
  assert.equal(t.value, v, 'at floor: no movement');
});

test('severity is clamped to 0..1; reset returns to the floor', () => {
  const t = new LossTension(5, 0.3);
  t.note(-3); // clamped to 0 → no-op (level starts at 0, not the floor)
  assert.equal(t.value, 0, `value ${t.value}`);
  t.note(7);
  assert.equal(t.value, 1, 'clamped above');
  t.reset();
  assert.ok(Math.abs(t.value - 0.3) < 1e-9, `value ${t.value}`);
});

test('invalid halfLife / floor throw', () => {
  assert.throws(() => new LossTension(0));
  assert.throws(() => new LossTension(-1));
  assert.throws(() => new LossTension(5, 1.5));
  assert.throws(() => new LossTension(5, -0.1));
});
