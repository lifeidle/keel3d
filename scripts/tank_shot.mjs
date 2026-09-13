import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await page.goto('http://localhost:4188/tank-preview.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(5000);
console.log('DEBUG:', JSON.stringify(await page.evaluate(() => window.__debug)));
await page.screenshot({ path: 'tank_shot.png' });
await browser.close();
