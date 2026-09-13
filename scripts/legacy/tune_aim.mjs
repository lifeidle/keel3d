import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 760, height: 980 } });
await p.goto('http://localhost:4188/soldier-preview.html', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
let best = null;
for (let u = -2.6; u <= 2.6; u += 0.4) {
  for (let l = -2.6; l <= 2.6; l += 0.4) {
    await p.evaluate(([uu, ll]) => { window.__aim.u = uu; window.__aim.l = ll; window.__aim.ul = uu; window.__aim.ll = ll; }, [u, l]);
    await p.waitForTimeout(40);
    const r = await p.evaluate(() => window.__aimcheck());
    const err = Math.abs(r.muzzleYawErrDeg);
    const h = r.muzzleHeight;
    if (h > 0.9 && h < 1.9 && err < 20) {
      if (!best || err < best.err) best = { u: +u.toFixed(2), l: +l.toFixed(2), err: +err.toFixed(1), h: +h.toFixed(2) };
    }
  }
}
console.log('BEST:', JSON.stringify(best));
await b.close();
