/**
 * Decisive demo QA: render each entry page in a real Chrome, then measure the
 * screenshot numerically — because a WebGPU canvas cannot be read back via
 * drawImage, and the operator may not be able to eyeball every tile.
 *
 * Per page we report:
 *   - hardwareConcurrency + webgpu adapter info (to catch a mis-tiered quality)
 *   - fps over a 1.2s rAF window
 *   - pixel stats on the screenshot: unique quantised colours, luminance std,
 *     and "contentFrac" = share of the lower 60% that departs from the top sky
 *     band. A real 3D scene scores high; a stuck/sky-only frame scores low.
 *
 * Usage: node scripts/qa-render.mjs [baseUrl] [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const outDir = process.argv[3] || 'qa-pixels';
mkdirSync(outDir, { recursive: true });

const pages = [
  ['hub', '/hub.html', null],
  ['fps', '/fps.html', '#boot'],
  ['tower', '/tower.html', '#td-hud'],
  ['openworld', '/openworld.html', '#cultivation-hud'],
  ['flight', '/flight.html', '#flight-hud'],
  ['race', '/race.html', '#race-hud'],
  ['arpg', '/arpg.html', '#arpg-hud'],
  ['collect', '/collect.html', '#collect-hud'],
  ['rally', '/rally.html', '#rally-hud'],
  ['dungeon', '/dungeon.html', '#dungeon-hud'],
  ['template', '/template.html', '#boot'],
  ['flight-arena', '/flight-arena.html', '#boot'],
  ['fps-arena', '/fps-arena.html', '#fps-arena-hud'],
  ['tps', '/tps.html', '#tps-hud'],
  ['roguelike', '/roguelike.html', '#rogue-hud'],
  ['platformer', '/platformer.html', '#plat-hud'],
  ['tycoon', '/tycoon.html', '#tycoon-hud'],
  ['rts', '/rts.html', '#rts-hud'],
  ['stealth', '/stealth.html', '#stealth-hud'],
  ['arena', '/arena.html', '#arena-hud'],
  ['rhythm', '/rhythm.html', '#rhythm-hud'],
  ['sandbox', '/sandbox.html', '#sandbox-hud'],
  ['br', '/br.html', '#br-hud'],
  ['puzzle', '/puzzle.html', '#puzzle-hud'],
  ['sports', '/sports.html', '#sports-hud'],
  ['soldier-preview', '/soldier-preview.html', null],
  ['tank-preview', '/tank-preview.html', null],
];

async function launch() {
  if (process.env.KEEL_PROBE_BROWSER === 'chromium') return chromium.launch();
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    return chromium.launch();
  }
}

/** Numeric description of a rendered frame. */
async function analyse(file) {
  const { data, info } = await sharp(file)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const px = (x, y) => {
    const i = (y * W + x) * C;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // sky reference = median colour of the top 8% band
  const bandH = Math.max(1, Math.floor(H * 0.08));
  const acc = [];
  for (let y = 0; y < bandH; y++)
    for (let x = 0; x < W; x += 3) acc.push(px(x, y));
  const med = [0, 1, 2].map((k) => {
    const s = acc.map((c) => c[k]).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  });
  // unique quantised colours + luminance stats + content vs sky
  const seen = new Set();
  let lumSum = 0;
  let lumSq = 0;
  let content = 0;
  let region = 0;
  const y0 = Math.floor(H * 0.4);
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const [r, g, b] = px(x, y);
      seen.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      lumSum += l;
      lumSq += l * l;
      if (y >= y0) {
        region++;
        const d = Math.abs(r - med[0]) + Math.abs(g - med[1]) + Math.abs(b - med[2]);
        if (d > 60) content++;
      }
    }
  }
  const n = Math.ceil(H / 2) * Math.ceil(W / 2);
  const mean = lumSum / n;
  const std = Math.sqrt(Math.max(0, lumSq / n - mean * mean));
  return {
    colors: seen.size,
    lumStd: Math.round(std),
    contentFrac: +(content / Math.max(1, region)).toFixed(3),
    sky: med.join(','),
  };
}

const browser = await launch();
const rows = [];
const weak = [];

for (const [name, p, sel] of pages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });

  let hc = 0;
  let adapter = '';
  let fps = 0;
  let canvas = 'none';
  let hasSel = true;
  let bootHidden = true;

  try {
    await page.goto(base + p, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(name === 'hub' ? 1500 : 4500);
    if (sel) hasSel = await page.evaluate((s) => !!document.querySelector(s), sel);

    const env = await page.evaluate(async () => {
      const out = { hc: navigator.hardwareConcurrency || 0, adapter: 'n/a', c: '' };
      try {
        const a = await navigator.gpu?.requestAdapter();
        if (a) {
          const i = a.info || {};
          out.adapter = [i.vendor, i.architecture, i.description].filter(Boolean).join('/') || 'ok';
        } else out.adapter = 'no-adapter';
      } catch (e) {
        out.adapter = 'err:' + String(e).slice(0, 40);
      }
      const c = document.querySelector('canvas');
      out.c = c ? `${c.width}x${c.height}` : 'none';
      const b = document.getElementById('boot');
      out.boot = !b
        ? true
        : getComputedStyle(b).display === 'none' ||
          b.classList.contains('hidden') ||
          getComputedStyle(b).visibility === 'hidden';
      return out;
    });
    hc = env.hc;
    adapter = env.adapter;
    canvas = env.c;
    bootHidden = env.boot;

    if (name !== 'hub') {
      fps = await page.evaluate(
        () =>
          new Promise((res) => {
            let n = 0;
            const t0 = performance.now();
            const tick = () => {
              n++;
              const dt = performance.now() - t0;
              if (dt < 1200) requestAnimationFrame(tick);
              else res(Math.round((n * 1000) / dt));
            };
            requestAnimationFrame(tick);
          }),
      );
    }

    const shot = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: shot });
    const stats = canvas === 'none' ? null : await analyse(shot);

    const isScene = name !== 'hub';
    // A scene page is "weak" if it renders almost nothing but sky.
    const weakScene = isScene && stats && stats.contentFrac < 0.02 && stats.colors < 12;
    const ok =
      errors.length === 0 &&
      bootHidden &&
      canvas !== 'none' &&
      (sel === '#boot' || hasSel || name === 'hub') &&
      (name === 'hub' || !weakScene);
    if (!ok) weak.push(name);

    rows.push({ name, ok, fps, canvas, hc, adapter, bootHidden, stats, errors: errors.slice(0, 3) });
    console.log(
      `${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(14)} fps=${String(fps).padStart(3)} ${canvas.padEnd(10)} ` +
        `colors=${String(stats?.colors ?? '-').padStart(4)} std=${String(stats?.lumStd ?? '-').padStart(3)} ` +
        `content=${String(stats?.contentFrac ?? '-').padStart(5)} hc=${hc} err=${errors[0] || 'none'}`,
    );
  } catch (e) {
    errors.push('NAV: ' + String(e).slice(0, 120));
    weak.push(name);
    rows.push({ name, ok: false, fps, canvas, hc, adapter, errors: errors.slice(0, 3) });
    console.log(`FAIL ${name.padEnd(14)} NAV ${String(e).slice(0, 90)}`);
  }
  await page.close();
}

await browser.close();
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(rows, null, 2));
console.log(`\nreport -> ${outDir}/report.json`);
console.log(weak.length ? `PIXEL-QA: ${weak.length} weak: ${weak.join(', ')}` : 'PIXEL-QA: all scenes render content');
process.exit(weak.length ? 1 : 0);
