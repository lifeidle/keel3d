/**
 * Scene-graph probe: uses the ?debug handle from main.ts to dump what the
 * renderer is actually asked to draw, plus the live camera pose. This turns
 * "the screenshot looks empty" into a countable fact.
 *
 * Usage: node scripts/qa-scene.mjs [baseUrl] name1,name2,...
 */
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const names = (
  process.argv[3] ||
  'arpg,tycoon,platformer,collect,tps,tower,openworld,race'
).split(',');

async function launch() {
  if (process.env.KEEL_PROBE_BROWSER === 'chromium') return chromium.launch();
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    return chromium.launch();
  }
}

const browser = await launch();
for (const name of names) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(`${base}/${name}.html?debug=1`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);

  const dump = await page.evaluate(() => {
    const k = window.__keel;
    if (!k) return { err: 'no __keel handle' };
    const cam = k.camera;
    const camPos = cam.position.clone();
    const out = {
      cam: {
        pos: [camPos.x, camPos.y, camPos.z].map((v) => +v.toFixed(2)),
        fov: cam.fov,
        near: +cam.near.toFixed(3),
        far: +cam.far.toFixed(1),
        dir: cam.getWorldDirection(new (cam.position.constructor)()).toArray().map((v) => +v.toFixed(3)),
      },
      bg: k.scene.background?.getHexString?.() ?? String(k.scene.background),
      fog: k.scene.fog ? [k.scene.fog.near, k.scene.fog.far] : null,
      children: [],
      total: 0,
      meshes: 0,
      basicMats: 0,
      stdMats: 0,
    };
    const walk = (o, depth) => {
      out.total++;
      const isMesh = o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine;
      if (isMesh) {
        out.meshes++;
        const m = o.material;
        const mats = Array.isArray(m) ? m : m ? [m] : [];
        for (const mm of mats) {
          if (mm.isMeshBasicMaterial) out.basicMats++;
          else if (mm.isMeshStandardMaterial || mm.isMeshPhysicalMaterial) out.stdMats++;
        }
      }
      if (depth <= 2) {
        const wp = o.getWorldPosition(new (camPos.constructor)());
        out.children.push({
          d: depth,
          n: o.name || '-',
          t: o.type,
          vis: o.visible,
          pos: [wp.x, wp.y, wp.z].map((v) => +v.toFixed(1)),
          dist: +wp.distanceTo(camPos).toFixed(1),
          mat: isMesh
            ? (Array.isArray(o.material) ? o.material[0] : o.material)?.type || '-'
            : undefined,
        });
      }
      for (const c of o.children) walk(c, depth + 1);
    };
    for (const c of k.scene.children) walk(c, 0);
    out.children = out.children.slice(0, 40);
    return out;
  });
  console.log(`\n===== ${name} ===== errs=${errs.length ? errs.join('|') : 'none'}`);
  console.log(JSON.stringify(dump, null, 1).slice(0, 3500));
  await page.close();
}
await browser.close();
