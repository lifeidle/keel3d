import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 760, height: 980 } });
await p.goto('http://localhost:4188/soldier-preview.html', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
let best = null;
for (let u = -0.2; u <= 1.4; u += 0.1) {
  for (let l = 0.2; l <= 1.8; l += 0.1) {
    await p.evaluate(([uu, ll]) => { window.__aim.u = uu; window.__aim.l = ll; window.__aim.ul = uu; window.__aim.ll = ll; }, [u, l]);
    await p.waitForTimeout(30);
    const r = await p.evaluate(() => window.__aimcheck());
    const err = Math.abs(r.muzzleYawErrDeg);
    const h = r.muzzleHeight;
    const score = err + Math.abs(h - 1.45) * 30; // prefer shoulder-high + forward
    if (!best || score < best.score) best = { u: +u.toFixed(2), l: +l.toFixed(2), err: +err.toFixed(1), h: +h.toFixed(2), score: +score.toFixed(1) };
  }
}
console.log('BEST:', JSON.stringify(best));
await b.close();
