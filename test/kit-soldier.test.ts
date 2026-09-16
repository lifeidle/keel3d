/**
 * kitSoldier — blocky humanoid rig (torso/head/helmet + walk-pose API).
 * Headless: THREE is pure-JS, so structure + pose math are testable.
 */
import assert from 'node:assert';
import { kitSoldier } from '../src/blocks/kit/Soldier';

const t = (name: string, fn: () => void) => {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name, e);
    process.exitCode = 1;
  }
};

t('rig structure: root/pivot/arms/legs/torso + hip height', () => {
  const r = kitSoldier({ body: 0x6f7a52, helmet: 0x3a4046 });
  assert.ok(r.root && r.pivot && r.armL && r.armR && r.legL && r.legR && r.torso);
  assert.strictEqual(r.pivot.position.y, 0.95, 'hip pivot height');
  assert.ok(r.root.children.length >= 1);
});

t('torso carries head + helmet dome + vest meshes (blocky silhouette)', () => {
  const r = kitSoldier({ body: 0x9a5a4a, helmet: 0x3a4046 });
  // 3 chest/shoulder boxes + vest + head + dome + brim = 7 children
  assert.ok(r.torso.children.length >= 7, `torso children ${r.torso.children.length}`);
});

t('body material carries the tint + emissive', () => {
  const r = kitSoldier({ body: 0x123456, helmet: 0x000000, emissive: 0.4 });
  assert.strictEqual(r.bodyMat.color.getHex(), 0x123456);
  assert.strictEqual(r.bodyMat.emissiveIntensity, 0.4);
});

t('setWalk swings legs in opposition, clamped amplitude', () => {
  const r = kitSoldier({ body: 0x6f7a52, helmet: 0x3a4046 });
  r.setWalk(Math.PI / 2, 1);
  const l = r.legL.rotation.x;
  const rr = r.legR.rotation.x;
  assert.ok(l > 0.4, `legL ${l}`);
  assert.ok(rr < -0.4, `legR ${rr}`);
  assert.ok(Math.abs(l + rr) < 1e-6, 'opposed');
  r.setWalk(0, 1);
  assert.ok(Math.abs(r.legL.rotation.x) < 1e-6, 'phase 0 → neutral');
  r.setWalk(Math.PI / 2, 3); // clamps to 1
  assert.ok(r.legL.rotation.x <= 0.56, 'amplitude clamped');
});

t('arms counter-swing with the walk (weapon arm stays forward-bent)', () => {
  const r = kitSoldier({ body: 0x6f7a52, helmet: 0x3a4046 });
  const baseR = r.armR.rotation.x;
  r.setWalk(Math.PI / 2, 1);
  assert.ok(r.armR.rotation.x > baseR, 'weapon arm pushes forward on stride');
});

console.log('kit-soldier tests complete');
