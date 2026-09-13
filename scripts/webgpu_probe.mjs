/**
 * Probe: WebGPU vs WebGL boot + start-match camera path.
 * Usage: node scripts/webgpu_probe.mjs [url]
 */
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5173/';

const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=vulkan',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(4000);

const boot = await page.evaluate(() => ({
  hasCanvas: !!document.querySelector('canvas'),
  canvasCount: document.querySelectorAll('canvas').length,
  bootHidden: document.getElementById('boot')?.classList.contains('hidden'),
  menuHidden: document.getElementById('menu')?.classList.contains('hidden'),
}));

// Click start
let clicked = false;
try {
  await page.locator('#btnPlay').click({ timeout: 3000 });
  clicked = true;
} catch (e) {
  logs.push(`[click-fail] ${e.message}`);
}

await page.waitForTimeout(2500);

const after = await page.evaluate(async () => {
  const menu = document.getElementById('menu');
  const pause = document.getElementById('pause');
  // sample over 2s to see if state ever becomes playing
  const samples = [];
  for (let i = 0; i < 8; i++) {
    samples.push({
      t: i * 250,
      menuH: menu?.classList.contains('hidden'),
      pauseH: pause?.classList.contains('hidden'),
      hud: document.getElementById('hud')?.style.display,
      fps: document.getElementById('fps-counter')?.textContent,
    });
    await new Promise((r) => setTimeout(r, 250));
  }
  return {
    menuHidden: menu?.classList.contains('hidden'),
    pauseHidden: pause?.classList.contains('hidden'),
    hudDisplay: document.getElementById('hud')?.style.display,
    samples,
  };
});

console.log(JSON.stringify({ url, boot, clicked, after, logs: logs.slice(0, 40) }, null, 2));
await page.screenshot({ path: 'shots/webgpu_probe.png', fullPage: false });
await browser.close();
