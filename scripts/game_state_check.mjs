import { chromium } from 'playwright';
const errors = [];
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 220)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 220)); });
await page.goto('http://localhost:4188/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);
await page.click('#btnPlay');
await page.waitForTimeout(13000);
const st = await page.evaluate(() => {
  const vis = (id) => { const el = document.getElementById(id); if (!el) return 'absent'; const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'; };
  const hud = document.getElementById('hud');
  return {
    hudVisible: vis('hud'), crosshair: vis('crosshair'), health: vis('health-wrap'), ammo: vis('ammo-wrap'),
    ammoText: (document.getElementById('ammo-line') || {}).textContent || '',
    healthFill: (document.getElementById('health-fill') || {}).style?.width || '',
    menuHidden: (() => { const m = document.getElementById('menu-screen') || document.querySelector('.screen'); return m ? getComputedStyle(m).display === 'none' : 'n/a'; })(),
  };
});
await page.waitForTimeout(6000);
const st2 = await page.evaluate(() => (document.getElementById('ammo-line') || {}).textContent || '');
console.log('STATE:', JSON.stringify(st));
console.log('AMMO_LATER:', st2, '| ERRORS:', errors.length ? errors.slice(0, 5).join('||') : 'none');
await page.screenshot({ path: 'shots/game3.png' });
await b.close();
