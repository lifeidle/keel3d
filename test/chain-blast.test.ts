import { test } from 'node:test';
import assert from 'assert/strict';
import { chainBlast } from '../src/blocks/combat/ChainBlast';

/**
 * ChainBlast — unified damage + trigger pass (pure, headless).
 */

test('damage + trigger inside the radius; out-of-range is zero + untriggered', () => {
  const items = [
    { x: 1, z: 0, alive: true, fuseRef: 'near' },
    { x: 10, z: 0, alive: true, fuseRef: 'far' },
  ];
  const r = chainBlast(0, 0, 4, 40, 0.9, items);
  // damage: near (d=1) full-ish, far (d=10) out of radius → 0
  const near = r.hits.find((h) => h.target.fuseRef === 'near')!;
  const far = r.hits.find((h) => h.target.fuseRef === 'far')!;
  assert.equal(near.hit, true);
  assert.ok(near.damage > 30, `near damage ${near.damage}`);
  assert.equal(far.hit, false);
  assert.equal(far.damage, 0);
  // trigger: only the near one
  assert.deepEqual(r.triggered.map((t) => t.fuseRef), ['near']);
});

test('trigger radius wider than the damage radius reaches further', () => {
  const items = [
    { x: 3, z: 0, alive: true, fuseRef: 'mid' }, // inside trigger (5), outside damage (4)? no: d=3 < 4 → also damaged
    { x: 4.5, z: 0, alive: true, fuseRef: 'edge' }, // damage edge (d=4.5>4 → zero), trigger (≤5)
  ];
  const r = chainBlast(0, 0, 4, 40, 0.9, items, { triggerRadius: 5 });
  assert.deepEqual(r.triggered.map((t) => t.fuseRef), ['mid', 'edge']);
  const edge = r.hits.find((h) => h.target.fuseRef === 'edge')!;
  assert.equal(edge.hit, false, 'beyond the damage radius');
  assert.ok(edge.damage === 0);
});

test('items without fuseRef take damage but never trigger', () => {
  const items = [
    { x: 1, z: 0, alive: true }, // no fuseRef
    { x: 2, z: 0, alive: true, fuseRef: 'b' },
  ];
  const r = chainBlast(0, 0, 4, 40, 0.9, items);
  const p = r.hits.find((h) => h.target.x === 1)!;
  assert.equal(p.hit, true, 'no-fuseRef items still take damage');
  assert.deepEqual(r.triggered.map((t) => t.fuseRef), ['b']);
});

test('exclude removes from damage AND trigger; triggerExclude is trigger-only', () => {
  const items = [
    { x: 1, z: 0, alive: true, fuseRef: 'src' },
    { x: 2, z: 0, alive: true, fuseRef: 'dead-target' },
    { x: 3, z: 0, alive: true, fuseRef: 'ok' },
  ];
  const r = chainBlast(
    0,
    0,
    4,
    40,
    0.9,
    items,
    {
      exclude: (t) => t.fuseRef === 'src',
      triggerExclude: (t) => t.fuseRef === 'dead-target',
    },
  );
  assert.ok(!r.hits.some((h) => h.target.fuseRef === 'src'), 'excluded from damage');
  assert.deepEqual(r.triggered.map((t) => t.fuseRef), ['ok']);
});

test('damageExclude removes from damage only — trigger-only items still trigger', () => {
  const items = [
    { x: 1, z: 0, alive: true, fuseRef: 'barrel' }, // trigger-only (e.g. a barrel)
    { x: 2, z: 0, alive: true }, // plain damage target (e.g. an enemy)
  ];
  const r = chainBlast(0, 0, 4, 40, 0.9, items, {
    damageExclude: (t) => t.fuseRef !== undefined,
  });
  // blastHits semantics: excluded items are not reported in `hits` at all
  assert.ok(!r.hits.some((h) => h.target.fuseRef === 'barrel'), 'not in damage report');
  const enemy = r.hits.find((h) => h.target.x === 2)!;
  assert.equal(enemy.hit, true, 'plain target still damaged');
  assert.deepEqual(r.triggered.map((t) => t.fuseRef), ['barrel'], 'still triggered');
});

test('dead items are skipped for both passes', () => {
  const items = [
    { x: 1, z: 0, alive: false, fuseRef: 'dead' },
    { x: 2, z: 0, alive: true, fuseRef: 'live' },
  ];
  const r = chainBlast(0, 0, 4, 40, 0.9, items);
  assert.ok(!r.hits.some((h) => h.target.fuseRef === 'dead'), 'dead: no damage report');
  assert.deepEqual(r.triggered.map((t) => t.fuseRef), ['live']);
});
