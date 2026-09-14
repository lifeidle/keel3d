import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon, isDungeonConnected } from '../src/blocks/world/ProcDungeon';

test('same seed produces identical dungeon', () => {
  const a = generateDungeon(42, { roomCount: 5 });
  const b = generateDungeon(42, { roomCount: 5 });
  assert.deepEqual(a.rooms, b.rooms);
  assert.deepEqual(a.corridors, b.corridors);
});

test('different seeds differ; graph is connected', () => {
  const a = generateDungeon(1, { roomCount: 6 });
  const b = generateDungeon(2, { roomCount: 6 });
  assert.notDeepEqual(a.rooms, b.rooms);
  assert.ok(isDungeonConnected(a));
  assert.ok(a.rooms[0].kind === 'start');
  assert.ok(a.rooms[a.rooms.length - 1].kind === 'boss');
});
