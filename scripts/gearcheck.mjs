import { chromium } from "playwright";
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 760, height: 980 } });
await p.goto("http://localhost:4188/soldier-preview.html", { waitUntil: "networkidle", timeout: 60000 });
await p.waitForTimeout(3000);
console.log("GEAR:", JSON.stringify(await p.evaluate(() => window.__gearcheck())));
await b.close();
