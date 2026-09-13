import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 760, height: 980 } });
await p.goto('http://localhost:4188/soldier-preview.html', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
let best = null;
const seen = new Set();
for (let u = -1.4; u <= 1.6; u += 0.2) {
  for (let l = -1.8; l <= 1.8; l += 0.2) {
    await p.evaluate(([uu, ll]) => { window.__aim.u = uu; window.__aim.l = ll; window.__aim.ul = uu; window.__aim.ll = ll; }, [u, l]);
    await p.waitForTimeout(30);
    const h = await p.evaluate(() => window.__hands);
    const a = await p.evaluate(() => window.__aimcheck());
    if (!h || !h.R) continue;
    const handY = h.R.y;
    const handZ = h.R.z; // negative = in front if soldier faces +Z? soldier faces +Z here
    const muzzleErr = Math.abs(a.muzzleYawErrDeg);
    // chest-level rifle: hands around y 1.1-1.45, roughly ahead of torso (z > 0.1 when facing +Z), muzzle forward
    const score = Math.abs(handY - 1.28) * 30 + (handZ < 0.05 ? 6 : 0) + (muzzleErr > 25 ? 8 : muzzleErr * 0.2);
    const key = u.toFixed(1) + '_' + l.toFixed(1);
    if (!best || score < best.score) best = { u: +u.toFixed(2), l: +l.toFixed(2), handY: +handY.toFixed(2), handZ: +handZ.toFixed(2), err: +muzzleErr.toFixed(0), score: +score.toFixed(1) };
  }
}
console.log('BEST:', JSON.stringify(best));
await b.close();
