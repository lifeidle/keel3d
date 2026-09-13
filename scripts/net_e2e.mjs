import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8790';
const browser = await chromium.launch({ channel: 'chrome' });

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = [];
  const notFound = [];
  p.on('pageerror', (e) => errs.push('[pageerror] ' + String(e).slice(0, 180)));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 180)); });
  p.on('response', (r) => { if (r.status() === 404) notFound.push(r.url().split('/').pop()); });
  return { p, ctx, errs, notFound };
}

async function hostRoom(p, pvp) {
  await p.goto(BASE + '/?debug=1', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(900);
  await p.click('#btnNet');
  await p.waitForTimeout(400);
  if (pvp) await p.click('.modeBtn[data-pvp="1"]');
  await p.click('#btnNetHost');
  await p.waitForFunction(() => {
    const el = document.getElementById('net-code');
    return el && el.textContent.replace(/[^A-Z2-9]/g, '').length === 4;
  }, null, { timeout: 30000 });
  return (await p.textContent('#net-code')).replace(/[^A-Z2-9]/g, '');
}

async function joinRoom(p, code) {
  await p.goto(BASE + '/?debug=1', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(800);
  await p.click('#btnNet');
  await p.waitForTimeout(400);
  await p.click('#btnNetJoin');
  await p.fill('#net-code-input', code);
  await p.click('#btnNetGo');
}

async function waitPlaying(p, tag) {
  await p.waitForFunction(() => {
    const el = document.getElementById('crosshair');
    return !!el && getComputedStyle(el).display !== 'none';
  }, null, { timeout: 90000 });
  console.log(' ', tag, 'PLAYING');
}

async function snapshotState(p) {
  return p.evaluate(() => {
    const end = document.getElementById('end');
    const endVisible = !!end && !end.classList.contains('hidden') && getComputedStyle(end).display !== 'none';
    const gc = (id) => (document.getElementById(id) || {}).textContent ?? '?';
    const w = window;
    return { endVisible, enemies: gc('enemy-count'), squad: gc('squad-count'), endTitle: gc('endTitle'),
             snaps: w.__sfSnaps ?? 0, sent: w.__sfSent ?? 0, end: w.__sfEnd ?? null,
             tick: w.__sfTick ?? null, play: w.__sfPlay ?? null, start: w.__sfStart ?? null };
  });
}

async function runMode(pvp) {
  const tag = pvp ? 'PVP' : 'COOP';
  console.log(`--- ${tag} run ---`);
  const A = await newPage();
  const B = await newPage();
  const code = await hostRoom(A.p, pvp);
  console.log('  room:', code, pvp ? '(hunt)' : '(coop)');
  await joinRoom(B.p, code);
  await waitPlaying(A.p, '  A(host)');
  await waitPlaying(B.p, '  B(client)');
  await B.p.waitForTimeout(12000); // observe — old bug killed the host in <1s
  const sa = await snapshotState(A.p);
  const sb = await snapshotState(B.p);
  console.log('  host:', JSON.stringify(sa));
  console.log('  client:', JSON.stringify(sb));
  console.log(`  errors: A=${A.errs.length ? A.errs.slice(0, 2).join('||') : 'none'} | B=${B.errs.length ? B.errs.slice(0, 2).join('||') : 'none'}`);
  console.log(`  sync: sent=${sa.sent} clientSnaps=${sb.snaps} seeds=${sa.start.seed === sb.start.seed ? 'MATCH' : 'MISMATCH'} pvpFlags=${sa.start.pvp === sb.start.pvp ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  404s: A=${[...new Set(A.notFound)].join(',') || 'none'} B=${[...new Set(B.notFound)].join(',') || 'none'}`);
  await A.p.screenshot({ path: `shots/net_${tag.toLowerCase()}_host.png` });
  await B.p.screenshot({ path: `shots/net_${tag.toLowerCase()}_client.png` });
    // benign noise: signaling polls 404 until the peer's slot exists
  const realErrs = (arr) => arr.filter((e) => !e.includes('404'));
  const ok = !sa.endVisible && !sb.endVisible && !realErrs(A.errs).length && !realErrs(B.errs).length;
  console.log(`  ${tag}: ${ok ? 'PASS' : 'FAIL'}`);
  await A.ctx.close();
  await B.ctx.close();
  return ok;
}

const coopOk = await runMode(false);
const pvpOk = await runMode(true);
await browser.close();
console.log('SUMMARY: coop=' + (coopOk ? 'PASS' : 'FAIL') + ' pvp=' + (pvpOk ? 'PASS' : 'FAIL'));
