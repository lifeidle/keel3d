import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TriggerZone } from '../src/blocks/interact/TriggerZone';
import { Pickup, PickupField } from '../src/blocks/interact/Pickup';
import { Interactable } from '../src/blocks/interact/Interactable';
import { SaveSlot, BestScoreSlot } from '../src/blocks/progress/SaveSlot';
import { RunState } from '../src/blocks/progress/RunState';

test('TriggerZone enter/exit/stay', () => {
  const log: string[] = [];
  const z = new TriggerZone({
    shape: { kind: 'sphere', x: 0, z: 0, radius: 5 },
    onEnter: (t) => log.push('in:' + t),
    onExit: (t) => log.push('out:' + t),
    onStay: (t) => log.push('stay:' + t),
  });
  z.update([{ tag: 'a', x: 1, z: 1 }]);
  z.update([{ tag: 'a', x: 1, z: 1 }]);
  z.update([{ tag: 'a', x: 50, z: 0 }]);
  assert.ok(log.includes('in:a'));
  assert.ok(log.filter((s) => s === 'stay:a').length >= 2);
  assert.ok(log.includes('out:a'));
  assert.equal(z.occupants, 0);
});

test('Pickup auto and manual', () => {
  let got = 0;
  const p = new Pickup({ id: 'gem', x: 0, z: 0, radius: 2, onCollect: () => got++ });
  assert.equal(p.tryCollect(10, 10), false);
  assert.equal(p.tryCollect(1, 0), true);
  assert.equal(got, 1);
  assert.equal(p.tryCollect(0, 0), false);

  const field = new PickupField([
    new Pickup({ id: 'a', x: 0, z: 0, auto: true }),
    new Pickup({ id: 'b', x: 3, z: 0, auto: false }),
  ]);
  field.update(0, 0);
  assert.equal(field.collectedCount, 1);
  field.collectNearest(3, 0);
  assert.equal(field.collectedCount, 2);
  assert.equal(field.remaining, 0);
});

test('Interactable uses and cooldown', () => {
  let n = 0;
  const it = new Interactable({
    id: 'door',
    x: 0,
    z: 0,
    radius: 3,
    uses: 2,
    cooldown: 1,
    onUse: () => n++,
  });
  assert.equal(it.tryUse(0, 0), true);
  assert.equal(it.tryUse(0, 0), false); // cooldown
  it.update(1.1);
  assert.equal(it.tryUse(0, 0), true);
  assert.equal(it.tryUse(0, 0), false); // uses exhausted
  assert.equal(n, 2);
  assert.equal(it.tryUse(20, 20), false);
});

test('SaveSlot and BestScoreSlot without localStorage (Node)', () => {
  const s = new SaveSlot({ key: 'test-slot' });
  assert.equal(s.save({ a: 1 }), false);
  assert.equal(s.load(), null);
  assert.equal(s.exists(), false);

  const best = new BestScoreSlot('best-test');
  assert.equal(best.read(), null);
  assert.equal(best.submit(10, 't', true), true);
  assert.equal(best.read('t'), null); // no localStorage in Node
});

test('RunState snapshot', () => {
  const r = new RunState();
  r.tick(1.5);
  r.addKill(2);
  r.set('waves', 3);
  assert.equal(r.kills, 2);
  assert.ok(Math.abs(r.time - 1.5) < 1e-9);
  assert.equal(r.get('waves'), 3);
  r.reset();
  assert.equal(r.kills, 0);
});
