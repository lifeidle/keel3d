/**
 * scale — main-menu operation-scale (difficulty) picker.
 * Covers: default standard, setScale switching, opScale readback, and the
 * storage-less fallback (Node has no localStorage → loadScale = standard).
 */
import assert from 'node:assert';
import { SCALES, setScale, opScale, loadScale } from '../src/world/scale';

const t = (name: string, fn: () => void) => {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name, e);
    process.exitCode = 1;
  }
};

t('default operation scale is standard', () => {
  const s = opScale();
  assert.strictEqual(s.key, 'standard');
  assert.strictEqual(s.dmgMul, 1);
  assert.strictEqual(s.hpMul, 1);
});

t('setScale switches to grand and opScale reads it back', () => {
  const s = setScale('grand');
  assert.strictEqual(s.key, 'grand');
  assert.strictEqual(opScale().key, 'grand');
  assert.strictEqual(opScale().hpMul, SCALES.grand.hpMul);
  // restore
  setScale('patrol');
  assert.strictEqual(opScale().key, 'patrol');
  setScale('standard');
});

t('all three scales carry increasing pressure', () => {
  const p = SCALES.patrol;
  const s = SCALES.standard;
  const g = SCALES.grand;
  assert.ok(p.enemies < s.enemies, 'patrol < standard enemies');
  assert.ok(s.enemies < g.enemies, 'standard < grand enemies');
  assert.ok(p.dmgMul <= s.dmgMul, 'patrol no harder than standard');
  assert.ok(g.hpMul >= s.hpMul, 'grand tougher than standard');
});

t('loadScale without storage falls back to standard (Node)', () => {
  const s = loadScale();
  assert.strictEqual(s.key, 'standard', 'no localStorage → standard');
});

console.log('scale tests complete');
