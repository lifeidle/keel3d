import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LootTable } from '../src/blocks/gameplay/LootTable';
import { Inventory } from '../src/blocks/gameplay/Inventory';
import { FactionMap } from '../src/blocks/gameplay/Faction';
import { InventoryGrid } from '../src/blocks/ui/InventoryGrid';

test('LootTable weighted roll and qty range', () => {
  let i = 0;
  const seq = [0.01, 0.99, 0.5];
  const rng = () => seq[i++ % seq.length];
  const t = new LootTable(
    [
      { id: 'a', weight: 90, qty: 1 },
      { id: 'b', weight: 10, qty: [2, 4] },
    ],
    { rng },
  );
  const one = t.rollOne();
  assert.equal(one?.id, 'a');
  const two = t.rollOne();
  assert.ok(two && two.qty >= 2 && two.qty <= 4);
  assert.equal(new LootTable([], { rng: () => 0 }).rollOne(), null);
});

test('Inventory stack, full, equip, serialize', () => {
  const inv = new Inventory({ slots: 2, stackLimit: 5 });
  assert.equal(inv.add({ id: 'potion', qty: 5 }), 0);
  assert.equal(inv.count('potion'), 5);
  assert.equal(inv.add({ id: 'ore', qty: 3 }), 0);
  assert.equal(inv.add({ id: 'gem', qty: 1 }), 1); // full
  assert.ok(inv.equip('weapon', { id: 'potion', qty: 1 }));
  assert.equal(inv.equipped.weapon?.id, 'potion');
  assert.ok(inv.remove('potion', 3));
  assert.equal(inv.count('potion'), 2);
  const json = inv.serialize();
  const inv2 = new Inventory({ slots: 2, stackLimit: 5 });
  inv2.restore(json);
  assert.equal(inv2.count('potion'), 2);
  assert.equal(inv2.count('ore'), 3);
});

test('FactionMap hostility', () => {
  const f = new FactionMap();
  f.setHostile('red', 'blue');
  assert.ok(f.isHostile('red', 'blue'));
  assert.ok(f.isHostile('blue', 'red'));
  assert.equal(f.isHostile('red', 'red'), false);
  f.setHostile('red', 'blue', false);
  assert.equal(f.isHostile('red', 'blue'), false);
  const all = FactionMap.allAgainstAll(['a', 'b', 'c']);
  assert.ok(all.isHostile('a', 'c'));
});

test('InventoryGrid safe without DOM', () => {
  const inv = new Inventory({ slots: 4 });
  const g = new InventoryGrid(inv);
  assert.equal(g.el, null);
  g.dispose();
});
