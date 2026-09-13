// Phase 0 browser regression: boot -> menu -> start match -> HUD alive check.
// Uses --enable-unsafe-webgpu to expose the real GPU adapter in headless Chrome.
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4173/';
const errors = [];
const logs = [];

const b = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--enable-unsafe-webgpu'],
});
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 260)));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') errors.push('[console] ' + t.slice(0, 260));
  if (t.includes('[createEngineAsync]') || t.includes('[RendererFacade]')) logs.push(t);
});

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(6000);

const boot = await page.evaluate(() => ({
  bootHidden: document.getElementById('boot')?.classList.contains('hidden'),
  bootTxt: document.getElementById('bootTxt')?.textContent || '',
  hasCanvas: !!document.querySelector('canvas'),
  menuVisible: (() => {
    const m = document.getElementById('menu-screen') || document.querySelector('#menu');
    return m ? getComputedStyle(m).display !== 'none' : 'n/a';
  })(),
}));

let clicked = false;
try {
  await page.locator('#btnPlay').click({ timeout: 8000 });
  clicked = true;
} catch (e) {
  errors.push('[click-fail] ' + String(e).slice(0, 200));
}

// let the match run: intro + a few seconds of gameplay
await page.waitForTimeout(14000);

const state = await page.evaluate(() => {
  const vis = (id) => {
    const el = document.getElementById(id);
    if (!el) return 'absent';
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };
  return {
    hudVisible: vis('hud'),
    crosshair: vis('crosshair'),
    health: vis('health-wrap'),
    ammo: vis('ammo-wrap'),
    ammoText: (document.getElementById('ammo-line') || {}).textContent || '',
    healthFill: (document.getElementById('health-fill') || {}).style?.width || '',
    fps: (document.getElementById('fps-counter') || {}).textContent || '',
  };
});

await page.screenshot({ path: 'shots/phase0_regress.png' });
console.log('BOOT:', JSON.stringify(boot));
console.log('CLICKED:', clicked);
console.log('STATE:', JSON.stringify(state));
console.log('RENDER_LOGS:', JSON.stringify(logs.slice(0, 6)));
console.log('ERRORS:', errors.length ? errors.slice(0, 6).join('\n---\n') : 'none');
await b.close();
