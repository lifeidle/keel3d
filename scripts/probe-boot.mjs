/**
 * Deep probe: every skeleton must actually leave the boot screen.
 * Usage: node scripts/probe-boot.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
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
let fail = 0;
for (const [name, path, sel] of pages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 140));
  });
  let bootHidden = true;
  let bootText = '';
  let hasSel = true;
  let title = '';
  try {
    await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(name === 'hub' ? 800 : 3500);
    title = await page.title();
    if (sel) hasSel = await page.evaluate((s) => !!document.querySelector(s), sel);
    const boot = await page.evaluate(() => {
      const el = document.getElementById('boot');
      if (!el) return { exists: false, hidden: true, text: '' };
      const cs = getComputedStyle(el);
      return {
        exists: true,
        hidden: cs.display === 'none' || el.classList.contains('hidden') || cs.visibility === 'hidden',
        text: (document.getElementById('bootTxt')?.textContent || '').slice(0, 120),
      };
    });
    bootHidden = boot.hidden;
    bootText = boot.text;
  } catch (e) {
    errors.push(String(e).slice(0, 120));
  }
  const ok = errors.length === 0 && bootHidden && (sel === '#boot' || hasSel || name === 'hub');
  if (!ok) fail++;
  console.log(
    `${ok ? 'OK ' : 'FAIL'} ${name.padEnd(12)} bootHidden=${bootHidden} sel=${hasSel} title=${title.slice(0, 28)} ${bootText ? 'txt=' + bootText : ''} err=${errors[0] || 'none'}`,
  );
  await page.close();
}
await browser.close();
if (fail) {
  console.error(`probe-boot: ${fail} page(s) failed`);
  process.exit(1);
}
console.log('probe-boot: all entries left boot OK');
