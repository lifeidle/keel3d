import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DamageNumbers,
  resolveDmgStyle,
} from '../src/blocks/ui/DamageNumber';

/**
 * DamageNumbers — R71: pure style resolution (headless) + headless safety.
 */

test('default styles match the original behaviour (normal / crit)', () => {
  assert.deepEqual(resolveDmgStyle(false), {
    size: 14,
    color: '#ffb0b0',
    rise: 36,
    ms: 650,
  });
  assert.deepEqual(resolveDmgStyle(true), {
    size: 18,
    color: '#ffd27a',
    rise: 36,
    ms: 650,
  });
});

test('opts override individual fields, defaults fill the rest', () => {
  assert.deepEqual(resolveDmgStyle(false, { size: 26, color: '#7fe0ff' }), {
    size: 26,
    color: '#7fe0ff',
    rise: 36,
    ms: 650,
  });
  assert.deepEqual(resolveDmgStyle(true, { color: '#fff', rise: 60, ms: 900 }), {
    size: 18,
    color: '#fff',
    rise: 60,
    ms: 900,
  });
  // crit + full override: opts win on every field
  assert.deepEqual(resolveDmgStyle(true, { size: 30, color: '#f0f', rise: 80, ms: 1200 }), {
    size: 30,
    color: '#f0f',
    rise: 80,
    ms: 1200,
  });
});

test('headless: spawn is a safe no-op without a document', () => {
  const d = new DamageNumbers();
  d.spawn(10, 10, '-22'); // no document in node → no crash, no DOM
  d.spawn(10, 10, 'x5', true, { size: 26 });
  d.dispose();
});
