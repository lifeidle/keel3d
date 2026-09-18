import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDayNight,
  mergePalette,
  PALETTES,
} from '../src/blocks/scene/TimeOfDay';

/**
 * TimeOfDay mood override (content-tuned atmospheres — e.g. yexi's brighter
 * readable night). Mock engine: applyDayNight touches only the duck-typed
 * members below (no three/Rapier → headless).
 */

type MockEngine = {
  moon: {
    color: { setHex: (h: number) => void };
    intensity: number;
    position: { set: (x: number, y: number, z: number) => void };
  };
  hemi: {
    color: { setHex: (h: number) => void };
    groundColor: { setHex: (h: number) => void };
    intensity: number;
  };
  skyNight: { visible: boolean };
  skyDay: { visible: boolean };
  scene: {
    background: { setHex: (h: number) => void };
    fog: { color: { setHex: (h: number) => void }; near: number; far: number };
  };
};

function mockEngine(): MockEngine {
  return {
    moon: {
      color: { setHex: () => {} },
      intensity: 0,
      position: { set: () => {} },
    },
    hemi: {
      color: { setHex: () => {} },
      groundColor: { setHex: () => {} },
      intensity: 0,
    },
    skyNight: { visible: false },
    skyDay: { visible: false },
    scene: {
      background: { setHex: () => {} },
      fog: { color: { setHex: () => {} }, near: 0, far: 0 },
    },
  };
}

test('mergePalette: no override returns the base palette reference', () => {
  assert.equal(mergePalette('night'), PALETTES.night);
  assert.equal(mergePalette('day'), PALETTES.day);
});

test('mergePalette: partial override merges without mutating the base', () => {
  const merged = mergePalette('night', { hemiInt: 1.2, keyInt: 0.9 });
  assert.equal(merged.hemiInt, 1.2);
  assert.equal(merged.keyInt, 0.9);
  assert.equal(merged.sky, PALETTES.night.sky, 'untouched fields preserved');
  assert.equal(merged.keyColor, PALETTES.night.keyColor);
  assert.equal(PALETTES.night.hemiInt, 0.6, 'base palette never mutated');
});

test('applyDayNight: no mood = base palette (regression)', () => {
  const engine = mockEngine();
  applyDayNight(engine as never, 'night', { near: 10, far: 60, bg: 0x10141c });
  assert.equal(engine.moon.intensity, PALETTES.night.keyInt);
  assert.equal(engine.hemi.intensity, PALETTES.night.hemiInt);
  assert.equal(engine.skyNight.visible, true);
  assert.equal(engine.skyDay.visible, false);
  assert.equal(engine.scene.fog.near, 10 * PALETTES.night.fogNearMul);
  assert.equal(engine.scene.fog.far, 60 * PALETTES.night.fogFarMul);
});

test('applyDayNight: mood fields apply; explicit keyOverride still wins for the key', () => {
  const engine = mockEngine();
  applyDayNight(
    engine as never,
    'night',
    null,
    { color: 0xc8bdff, intensity: 0.62 },
    { night: { hemiInt: 0.9, keyInt: 0.95, hemiGround: 0x2a3326 } },
  );
  assert.equal(engine.moon.intensity, 0.62, 'keyOverride wins over mood keyInt');
  assert.equal(engine.hemi.intensity, 0.9, 'mood hemi fill applied');
});

test('applyDayNight: mood keyInt drives the key when no keyOverride', () => {
  const engine = mockEngine();
  applyDayNight(engine as never, 'night', null, null, {
    night: { hemiInt: 0.9, keyInt: 0.95 },
  });
  assert.equal(engine.moon.intensity, 0.95);
  assert.equal(engine.hemi.intensity, 0.9);
});

test('applyDayNight: day mood is independent of the night mood', () => {
  const engine = mockEngine();
  applyDayNight(
    engine as never,
    'day',
    { near: 10, far: 80, bg: 0x9db4cc, dayMix: 0.94 },
    null,
    { night: { hemiInt: 0.9 }, day: { keyInt: 1.5 } },
  );
  // day key scales with weather dayMix (cloud dimming)
  assert.ok(
    Math.abs(engine.moon.intensity - 1.5 * (0.3 + 0.7 * 0.94)) < 1e-9,
    `day key ${engine.moon.intensity}`,
  );
  assert.equal(engine.hemi.intensity, PALETTES.day.hemiInt, 'night mood does not leak into day');
});

test('PALETTES: night is dimmer than day (sanity of the two moods)', () => {
  assert.ok(PALETTES.night.keyInt < PALETTES.day.keyInt);
  assert.ok(PALETTES.night.hemiInt < PALETTES.day.hemiInt);
});
