/**
 * ClothFlags — camp banners (hostile red / friendly green) on a structural
 * TerrainLike. Headless: flat {heightAt} qualifies; update ripples cloth
 * vertices in place.
 */
import assert from 'node:assert';
import { ClothFlags } from '../src/blocks/props/ClothFlags';

const t = (name: string, fn: () => void) => {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name, e);
    process.exitCode = 1;
  }
};

t('accepts a flat structural terrain (duck-typed TerrainLike)', () => {
  const flat = { heightAt: () => 0 };
  const f = new ClothFlags(flat, { x: 0, z: -30 }, { x: 1, z: 1 });
  // 2 poles + 2 cloths
  assert.strictEqual(f.group.children.length, 4, `children ${f.group.children.length}`);
});

t('flag materials carry hostile/friendly tints', () => {
  const f = new ClothFlags({ heightAt: () => 0 }, { x: 0, z: -30 }, { x: 1, z: 1 });
  assert.strictEqual(f.mats.hostile.color.getHex(), 0x8f2f2f);
  assert.strictEqual(f.mats.friendly.color.getHex(), 0x3f7a3a);
});

t('terrain height lifts the poles', () => {
  const hilly = { heightAt: (_x: number, _z: number) => 3.5 };
  const f = new ClothFlags(hilly, { x: 0, z: -30 }, { x: 1, z: 1 });
  const pole = f.group.children[0] as { position: { y: number } };
  assert.ok(pole.position.y > 3.5, `pole y ${pole.position.y}`);
});

t('update ripples the cloth vertices (attribute mutates in place)', () => {
  const f = new ClothFlags({ heightAt: () => 0 }, { x: 0, z: -30 }, { x: 1, z: 1 });
  // children order: [hostile pole, hostile cloth, friendly pole, friendly cloth]
  const cloth = f.group.children[1] as { geometry: { attributes: Record<string, { array: Float32Array }> } };
  const before = new Float32Array(cloth.geometry.attributes.position.array);
  f.update(0.5);
  let changed = false;
  const arr = cloth.geometry.attributes.position.array;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== before[i]) {
      changed = true;
      break;
    }
  }
  assert.ok(changed, 'cloth vertices move after update');
});

console.log('cloth-flags tests complete');
