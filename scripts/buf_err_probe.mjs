// Probe: is the "Buffer used in submit while destroyed" error persistent during gameplay?
import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true, channel: 'chrome', args: ['--enable-unsafe-webgpu'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
let bufErrs = 0;
let otherErrs = 0;
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (m.text().includes('used in submit while destroyed')) bufErrs++;
  else otherErrs++;
});

await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(6000);
await page.locator('#btnPlay').click({ timeout: 8000 });

// phase 1: first 10s of match
const n0 = bufErrs;
await page.waitForTimeout(10000);
const n1 = bufErrs;
// phase 2: next 10s
await page.waitForTimeout(10000);
const n2 = bufErrs;

console.log(JSON.stringify({
  bootPhase: n0,
  matchFirst10s: n1 - n0,
  matchNext10s: n2 - n1,
  total: bufErrs,
  otherErrs,
}, null, 2));
await b.close();
