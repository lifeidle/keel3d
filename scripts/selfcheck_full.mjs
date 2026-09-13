import { chromium } from 'playwright';

const errors = [];
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 220)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 220));
});

// ---- part 1: soldier preview page (model + rifle + gear + aim) ----
await page.goto('http://localhost:4188/soldier-preview.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const info = await page.textContent('#info');
const gear = await page.evaluate(() => window.__gearcheck());
const aim = await page.evaluate(() => window.__aimcheck());
await page.screenshot({ path: 'shots/preview.png' });

// ---- part 2: the real game (menu -> solo match -> gameplay) ----
await page.goto('http://localhost:4188/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/menu.png' });
await page.click('#btnPlay');
await page.waitForTimeout(12000); // world gen + cinematic fly-in
await page.screenshot({ path: 'shots/game1.png' });
await page.waitForTimeout(9000);
await page.screenshot({ path: 'shots/game2.png' });

console.log('INFO:', info);
console.log('GEAR:', JSON.stringify(gear));
console.log('AIM:', JSON.stringify(aim));
console.log('ERRORS(' + errors.length + '):', errors.length ? errors.slice(0, 8).join(' || ') : 'none');
await b.close();
