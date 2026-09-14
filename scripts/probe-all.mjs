/**
 * Probe every skeleton HTML entry for load errors + key HUD/boot.
 *   node scripts/probe-all.mjs [baseUrl]
 * Default baseUrl: http://localhost:4173
 */
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4173';
const pages = [
  ['hub', '/hub.html', 'hub'],
  ['fps', '/fps.html', '#boot'],
  ['tower', '/tower.html', '#tower-hud'],
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
];

const browser = await chromium.launch({ channel: 'chrome' });
let fail = 0;

for (const [name, path, sel] of pages) {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(name === 'hub' ? 800 : 2800);
    const has = await page.evaluate((s) => !!document.querySelector(s), sel);
    const title = await page.title();
    const ok = errors.length === 0 && (sel === '#boot' || has || name === 'hub');
    if (!ok) fail++;
    console.log(`${ok ? 'OK ' : 'FAIL'} ${name.padEnd(12)} sel=${has} title=${title.slice(0, 40)} err=${errors[0] || 'none'}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${name.padEnd(12)} ${String(e).slice(0, 120)}`);
  }
  await page.close();
}

await browser.close();
if (fail) {
  console.error(`probe-all: ${fail} page(s) failed`);
  process.exit(1);
}
console.log('probe-all: all entries OK');
