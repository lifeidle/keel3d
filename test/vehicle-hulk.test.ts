/**
 * VehicleHulk — static prop placement (injected physics/terrain → headless).
 * Covers: prop colliders land on the injected ground height; the optional
 * plumes smoke column is only used when provided; prop variety.
 */
import assert from 'node:assert';
import {
  placeBunker,
  placeTankHulk,
  placeTruck,
  placeFenceRow,
  type HulkPhysics,
  type HulkTerrain,
} from '../src/blocks/props/VehicleHulk';

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Mock physics — records static boxes. */
const mockPhysics = () => {
  const boxes: { pos: { x: number; y: number; z: number }; half: { x: number; y: number; z: number } }[] = [];
  return {
    boxes,
    addStaticBox: (pos: { x: number; y: number; z: number }, half: { x: number; y: number; z: number }) => {
      boxes.push({ pos: { ...pos }, half: { ...half } });
      return null as unknown as import('@dimforge/rapier3d').Collider;
    },
  };
};

/** Mock terrain — flat at a fixed height (HulkTerrain is structural). */
const flatTerrain = (h: number): HulkTerrain => ({ heightAt: () => h });

// empty three-ish group stand-in — props add meshes to it; the block only needs
// .add() + .position/rotation, so a minimal object suffices.
const mockGroup = (): unknown => {
  const children: unknown[] = [];
  return {
    add: (c: unknown) => {
      children.push(c);
    },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    children,
  };
};

// smoke column mock — records columns
const mockPlumes = () => {
  const cols: number[] = [];
  return {
    cols,
    addColumn: (x: number, _y: number, _z: number, r: number) => {
      cols.push(r);
    },
  };
};

const t = (name: string, fn: () => void) => {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name, e);
    process.exitCode = 1;
  }
};

t('bunker places colliders on the injected ground height', () => {
  const phys = mockPhysics();
  const h = placeBunker(mockGroup() as never, phys as never, flatTerrain(5), mulberry32(7), 3, -2);
  assert.ok(h.colliders.length > 0, 'bunker has colliders');
  assert.ok(phys.boxes.length > 0, 'static boxes recorded');
  // all colliders sit on top of the ground plane at y=5 (y = 5 + ly + h/2 ≥ 5)
  for (const b of phys.boxes) assert.ok(b.pos.y >= 5, `collider y ${b.pos.y} ≥ ground 5`);
});

t('tank hulk works WITHOUT smoke columns (plumes = null)', () => {
  const phys = mockPhysics();
  const h = placeTankHulk(mockGroup() as never, phys as never, flatTerrain(0), mulberry32(11), null, 0, 0, true);
  assert.ok(h.colliders.length > 0, 'tank hull collider present');
});

t('burnt tank WITH plumes adds exactly one smoke column', () => {
  const phys = mockPhysics();
  const plumes = mockPlumes();
  placeTankHulk(mockGroup() as never, phys as never, flatTerrain(0), mulberry32(12), plumes as never, 0, 0, true);
  assert.strictEqual(plumes.cols.length, 1, 'burnt tank = one smoke column');
});

t('unburnt tank does not smoke', () => {
  const phys = mockPhysics();
  const plumes = mockPlumes();
  placeTankHulk(mockGroup() as never, phys as never, flatTerrain(0), mulberry32(13), plumes as never, 0, 0, false);
  assert.strictEqual(plumes.cols.length, 0, 'no smoke when unburnt');
});

t('truck + fence row place multiple colliders', () => {
  const phys = mockPhysics();
  const a = placeTruck(mockGroup() as never, phys as never, flatTerrain(0), mulberry32(21), 4, 4);
  const b = placeFenceRow(mockGroup() as never, phys as never, flatTerrain(0), mulberry32(22), -6, 0);
  assert.ok(a.colliders.length >= 1, 'truck collider');
  assert.ok(b.colliders.length >= 1, 'fence colliders');
  assert.ok(phys.boxes.length >= a.colliders.length + b.colliders.length, 'all boxes recorded');
});

console.log('vehicle-hulk tests complete');
