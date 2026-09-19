import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickHints,
  HotkeyHintPanel,
  type HotkeyHint,
} from '../src/blocks/ui/HotkeyHint';

/**
 * R79 — contextual hotkey hints (pickHints pure + panel headless).
 */

const H = (key: string, label: string, active: boolean, priority = 0): HotkeyHint => ({
  key,
  label,
  active,
  priority,
});

test('pickHints: filters inactive, sorts by priority, caps at max', () => {
  const out = pickHints(
    [H('F', 'resupply', true, 1), H('E', 'board', true, 2), H('T', 'nade', false, 9), H('Q', 'flare', true, 1)],
    2,
  );
  assert.deepEqual(out.map((h) => h.key), ['E', 'F'], 'active only, priority desc, cap 2');
});

test('pickHints: all inactive → empty', () => {
  assert.deepEqual(pickHints([H('E', 'board', false)]), []);
});

test('pickHints: equal priority keeps input order (stable)', () => {
  const out = pickHints([H('A', 'a', true), H('B', 'b', true), H('C', 'c', true)], 3);
  assert.deepEqual(out.map((h) => h.key), ['A', 'B', 'C']);
});

test('panel: headless-safe constructor + visible() mirrors pickHints', () => {
  const p = new HotkeyHintPanel();
  assert.equal(p.el, null, 'no DOM in headless');
  p.set([H('F', 'resupply', true, 1), H('E', 'board', true, 2)]);
  assert.deepEqual(p.visible().map((h) => h.key), ['E', 'F']);
  p.set([H('E', 'board', false)]);
  assert.equal(p.visible().length, 0);
  p.dispose();
});
