/**
 * Demo QA probe: for every entry page — did it leave boot, any console errors,
 * what FPS does the render loop actually reach, is a WebGPU canvas present —
 * plus a screenshot per page and one contact sheet for eyeball review.
 *
 * Usage: node scripts/qa-shots.mjs [baseUrl] [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const outDir = process.argv[3] || 'qa-shots';
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
  // not covered by probe-boot.mjs, but live on the site:
  ['index', '/index.html', null], // meta-refresh stub -> hub.html
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

const browser = await launch();
const rows = [];
const failed = [];

for (const [name, p, sel] of pages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });

  let bootHidden = true;
  let bootText = '';
  let hasSel = true;
  let title = '';
  let fps = 0;
  let canvas = 'none';
  let gpu = false;

  try {
    await page.goto(base + p, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(name === 'hub' ? 1200 : 4000);
    title = await page.title();
    if (sel) hasSel = await page.evaluate((s) => !!document.querySelector(s), sel);

    const boot = await page.evaluate(() => {
      const el = document.getElementById('boot');
      if (!el) return { hidden: true, text: '' };
      const cs = getComputedStyle(el);
      return {
        hidden:
          cs.display === 'none' || el.classList.contains('hidden') || cs.visibility === 'hidden',
        text: (document.getElementById('bootTxt')?.textContent || '').slice(0, 120),
      };
    });
    bootHidden = boot.hidden;
    bootText = boot.text;

    const info = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return { has: !!c, w: c?.width || 0, h: c?.height || 0, gpu: !!navigator.gpu };
    });
    canvas = info.has ? `${info.w}x${info.h}` : 'MISSING';
    gpu = info.gpu;

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

    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  } catch (e) {
    errors.push('NAV: ' + String(e).slice(0, 120));
  }

  const ok = errors.length === 0 && bootHidden && (sel === '#boot' || hasSel || name === 'hub');
  if (!ok) failed.push(name);
  rows.push({
    name,
    ok,
    bootHidden,
    sel: hasSel,
    fps,
    canvas,
    gpu,
    title,
    bootText,
    errors: errors.slice(0, 3),
  });
  console.log(
    `${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(12)} fps=${String(fps).padStart(3)} canvas=${canvas.padEnd(10)} boot=${bootHidden ? 'left' : 'STUCK'} sel=${hasSel} err=${errors[0] || 'none'}`,
  );
  await page.close();
}

await browser.close();
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(rows, null, 2));

// ---- contact sheet (5 columns) so all demos can be reviewed at a glance
const COLS = 5;
const TW = 384;
const TH = 216;
const LBL = 19;
const gridRows = Math.ceil(pages.length / COLS);
const W = COLS * TW;
const H = gridRows * (TH + LBL);
const composites = [];
for (let i = 0; i < pages.length; i++) {
  const [name] = pages[i];
  const x = (i % COLS) * TW;
  const y = Math.floor(i / COLS) * (TH + LBL);
  const tile = await sharp(path.join(outDir, `${name}.png`))
    .resize(TW, TH, { fit: 'cover' })
    .toBuffer();
  composites.push({ input: tile, left: x, top: y + LBL });
  const bad = failed.includes(name);
  const svg = `<svg width="${TW}" height="${LBL}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${bad ? '#7a1f1f' : '#161616'}"/><text x="5" y="14" font-family="monospace" font-size="13" fill="${bad ? '#ffd0d0' : '#d8d8d8'}">${name}${bad ? '  FAIL' : ''}</text></svg>`;
  composites.push({ input: Buffer.from(svg), left: x, top: y });
}
await sharp({ create: { width: W, height: H, channels: 3, background: '#000000' } })
  .composite(composites)
  .png()
  .toFile(path.join(outDir, 'contact-sheet.png'));

console.log(`\nscreenshots + contact-sheet.png -> ${outDir}`);
console.log(
  failed.length ? `QA: ${failed.length} page(s) failed: ${failed.join(', ')}` : 'QA: all pages OK',
);
process.exit(failed.length ? 1 : 0);
