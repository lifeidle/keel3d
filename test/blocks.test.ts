import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from '../src/blocks/Pool';
import { Path } from '../src/blocks/Path';
import * as Steering from '../src/blocks/Steering';
import { GridAStar } from '../src/blocks/GridAStar';
import { ChunkWorld } from '../src/blocks/ChunkWorld';
import { buildMap } from '../src/blocks/MapBuilder';

test('Pool acquires and releases without leaking live items', () => {
  const p = new Pool(() => ({ n: 0 }), (i) => { i.n = 0; }, 2);
  const a = p.acquire();
  const b = p.acquire();
  const c = p.acquire(); // over capacity → factory
  assert.equal(p.activeCount, 3);
  p.release(a);
  p.release(b);
  assert.equal(p.activeCount, 1);
  p.releaseAll();
  assert.equal(p.activeCount, 0);
  assert.ok(p.spareCount >= 2);
});

test('Path samples positions and end point', () => {
  const path = new Path([
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 0, z: 10 },
  ]);
  assert.ok(Math.abs(path.totalLen - 20) < 1e-6);
  const mid = path.sampleAt(10);
  assert.ok(Math.abs(mid.x - 10) < 1e-6);
  assert.ok(Math.abs(mid.z - 0) < 1e-6);
  const end = path.end();
  assert.equal(end.x, 10);
  assert.equal(end.z, 10);
});

test('Steering seek/flank/separation are pure and consistent', () => {
  const s = Steering.seekDir(0, 0, 10, 0, 0);
  assert.ok(s && Math.abs(s.x - 1) < 1e-6);
  assert.equal(Steering.seekDir(0, 0, 1, 0, 2), null);
  const f = Steering.flankDir(1, 0, 1);
  assert.ok(Math.abs(Math.hypot(f.x, f.z) - 1) < 1e-6);
  const sep = Steering.separationDelta(0, 0, 0.5, 0, 1.1, 2.2);
  assert.ok(sep);
  assert.ok(sep!.ax < 0 && sep!.bx > 0);
});

test('GridAStar finds a path around a blocked cell', () => {
  const g = new GridAStar({ width: 10, height: 10, originX: 0, originZ: 0, cell: 1 });
  for (let z = 0; z < 9; z++) g.blockCell(5, z); // wall with a gap at z=9
  const path = g.findPath(1, 1, 8, 1);
  assert.ok(path && path.length > 2);
  assert.ok(path!.every((p) => !(p.x > 4.5 && p.x < 5.5 && p.z < 8.5)));
});

test('ChunkWorld loads ring and unloads when focus moves', () => {
  const built: string[] = [];
  const cw = new ChunkWorld({
    chunkSize: 10,
    ring: 1,
    buildChunk: (cx: number, cz: number) => {
      built.push(`${cx},${cz}`);
      return { name: 'chunk', position: { set() {} } } as unknown as never;
    },
  });
  cw.update(0, 0);
  assert.equal(cw.loadedCount, 9);
  const before = cw.loadedKeys().slice().sort().join('|');
  cw.update(0, 0);
  assert.equal(cw.loadedKeys().slice().sort().join('|'), before); // stable
  cw.update(50, 0); // move focus far
  assert.equal(cw.loadedCount, 9);
  assert.ok(!cw.loadedKeys().includes('0,0'));
});

test('MapBuilder dispatches seeded/fixed/stream', () => {
  const seeded = buildMap(
    { kind: 'seeded', gen: (s) => s },
    { seeded: (s) => ({ world: s }) },
    { seed: 7 },
  );
  assert.equal(seeded.kind, 'seeded');
  assert.equal(seeded.seed, 7);

  const fixed = buildMap(
    { kind: 'fixed', maps: [{ id: 'a', terrain: { size: 1 } }, { id: 'b', terrain: { size: 2 } }] },
    { fixed: (d) => d.id },
    { fixedId: 'b' },
  );
  assert.equal(fixed.kind, 'fixed');
  assert.equal(fixed.fixed?.id, 'b');

  const stream = buildMap(
    { kind: 'stream', root: '/c', chunk: 32, lodRings: [1] },
    { stream: () => ({ ok: 1 }) },
  );
  assert.equal(stream.kind, 'stream');
});
