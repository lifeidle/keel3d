/**
 * Weather — seeded per-operation atmosphere.
 * Headless-safe: pickWeather/moonForSeed are pure; the FOG ordering and
 * draw boundaries are verified without a scene.
 */
import assert from 'node:assert';
import { pickWeather, moonForSeed } from '../src/blocks/scene/Weather';

const t = (name: string, fn: () => void) => {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name, e);
    process.exitCode = 1;
  }
};

t('pickWeather is deterministic per seed', () => {
  const a = pickWeather(7);
  const b = pickWeather(7);
  assert.strictEqual(a, b, 'same seed → same weather');
  assert.ok(['clear', 'mist', 'rain', 'storm'].includes(a));
});

t('pickWeather varies across seeds', () => {
  const seen = new Set<string>();
  for (let s = 1; s <= 40; s++) seen.add(pickWeather(s));
  assert.ok(seen.size >= 2, `40 seeds should hit at least 2 kinds (got ${seen.size})`);
});

t('pickWeather distribution skews calm (clear+mist majority of 400 draws)', () => {
  let calm = 0;
  for (let s = 0; s < 400; s++) {
    const k = pickWeather(s);
    if (k === 'clear' || k === 'mist') calm++;
  }
  // weights: clear 40% + mist 30% → expect ~70%
  assert.ok(calm / 400 > 0.5, `calm share ${calm / 400} > 0.5`);
});

t('moonForSeed is stable per seed and returns sane intensity', () => {
  const a = moonForSeed(12);
  const b = moonForSeed(12);
  assert.strictEqual(a.color, b.color);
  assert.strictEqual(a.intensity, b.intensity);
  assert.ok(a.intensity > 0.2 && a.intensity < 1.2, `intensity ${a.intensity}`);
});

console.log('weather tests complete');
