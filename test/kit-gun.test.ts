/**
 * kitGun — blocky weapon viewmodel (muzzle marker + optional arms).
 * Headless: THREE is pure-JS; structure + marker placement are testable.
 */
import assert from 'node:assert';
import { kitGun } from '../src/blocks/kit/Gun';

const t = (name: string, fn: () => void) => {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name, e);
    process.exitCode = 1;
  }
};

function meshes(g: { children: unknown[] }): number {
  let n = 0;
  const walk = (o: { isMesh?: boolean; children?: unknown[] }) => {
    if (o.isMesh) n++;
    for (const c of o.children ?? []) walk(c as never);
  };
  walk(g as never);
  return n;
}

t('base viewmodel: body/barrel/mag/grip/sights + named muzzle marker', () => {
  const g = kitGun();
  assert.ok(g.group.children.length >= 8, `children ${g.group.children.length}`);
  assert.strictEqual(g.muzzle.name, 'muzzle');
  assert.ok(g.muzzle.parent === g.group, 'muzzle is a direct child');
  assert.ok(meshes(g.group) >= 7, `meshes ${meshes(g.group)}`);
  // muzzle must point forward (-Z) ahead of the body
  assert.ok(g.muzzle.position.z < -0.4, `muzzle z ${g.muzzle.position.z}`);
});

t('arms option adds sleeves + gloves + curled fingers', () => {
  const bare = kitGun();
  const armed = kitGun({ arms: true });
  assert.ok(meshes(armed.group) > meshes(bare.group) + 6, 'arms add >6 meshes');
});

t('length/barrel opts scale the silhouette', () => {
  const long = kitGun({ length: 1.2, barrel: 0.7 });
  const short = kitGun({ length: 0.6, barrel: 0.3 });
  assert.ok(long.muzzle.position.z < short.muzzle.position.z, 'longer gun → muzzle further out');
});

t('materials are fresh per call (traverse-dispose safe)', () => {
  const a = kitGun();
  const b = kitGun();
  assert.notStrictEqual(a.metalMat, b.metalMat);
});

console.log('kit-gun tests complete');
