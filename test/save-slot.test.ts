import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SaveSlot,
  BestScoreSlot,
  memoryStore,
} from '../src/blocks/progress/SaveSlot';

const DEF = { kills: 0, name: 'anon' };

test('fresh slot: load null, exists false', () => {
  const slot = new SaveSlot({ key: 'a', store: memoryStore() });
  assert.equal(slot.load(), null);
  assert.equal(slot.exists(), false);
});

test('save → load round-trip (injected memory store)', () => {
  const slot = new SaveSlot({ key: 'a', store: memoryStore() });
  assert.equal(slot.save({ kills: 42, name: 'raider' }), true);
  assert.equal(slot.exists(), true);
  assert.deepEqual(slot.load(), { kills: 42, name: 'raider' });
});

test('version mismatch with migrator → migrated payload', () => {
  const store = memoryStore();
  const old = new SaveSlot({ key: 'a', version: 1, store });
  old.save({ kills: 99, name: 'old' });
  const slot = new SaveSlot({
    key: 'a',
    version: 2,
    store,
    migrate: (d) => ({ kills: (d.kills as number) * 2, name: 'migrated' }),
  });
  assert.deepEqual(slot.load(), { kills: 198, name: 'migrated' });
});

test('version mismatch WITHOUT migrator → old data as-is (existing semantics)', () => {
  const store = memoryStore();
  const old = new SaveSlot({ key: 'a', version: 1, store });
  old.save({ kills: 99, name: 'old' });
  const slot = new SaveSlot({ key: 'a', version: 2, store });
  assert.deepEqual(slot.load(), { kills: 99, name: 'old' });
});

test('corrupted JSON → null (never throws)', () => {
  const store = memoryStore();
  store.save('a', '{not json!!');
  const slot = new SaveSlot({ key: 'a', store });
  assert.equal(slot.load(), null);
});

test('clear() → next load null', () => {
  const slot = new SaveSlot({ key: 'a', store: memoryStore() });
  slot.save(DEF);
  slot.clear();
  assert.equal(slot.load(), null);
  assert.equal(slot.exists(), false);
});

test('keys are isolated (same store)', () => {
  const store = memoryStore();
  const a = new SaveSlot({ key: 'a', store });
  const b = new SaveSlot({ key: 'b', store });
  a.save(DEF);
  assert.deepEqual(a.load(), DEF);
  assert.equal(b.load(), null);
});

test('BestScoreSlot: submit / read / improved flag / lowerIsBetter', () => {
  const slot = new BestScoreSlot('score', memoryStore());
  assert.equal(slot.read(), null);
  assert.equal(slot.submit(100), true); // first submit is a record
  assert.equal(slot.submit(90), false); // worse
  assert.equal(slot.read(), 100);
  assert.equal(slot.submit(150), true); // better
  assert.equal(slot.read(), 150);

  const lap = new BestScoreSlot('lap', memoryStore());
  assert.equal(lap.submit(500), true);
  assert.equal(lap.submit(520, 'best', true), false); // slower lap
  assert.equal(lap.submit(480, 'best', true), true); // faster lap
  assert.equal(lap.read(), 480);
});

test('no store + no localStorage → save false / load null (headless degrade)', () => {
  const slot = new SaveSlot({ key: 'a', store: null as unknown as import('../src/blocks/progress/SaveSlot').SaveStore });
  assert.equal(slot.save(DEF), false);
  assert.equal(slot.load(), null);
});
