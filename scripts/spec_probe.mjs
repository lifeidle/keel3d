import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
for (const id of ["flight", "race"]) {
  const errors = [];
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  await page.goto("http://localhost:4188/?game=" + id, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  const hud = await page.evaluate((gid) => document.getElementById(gid + "-hud")?.textContent || "no-hud", id);
  console.log(id + ": " + hud + " errors: " + (errors.length ? errors.slice(0,2).join("|") : "none"));
  await page.screenshot({ path: "shots/demo_" + id + ".png" });
  await page.close();
}
await b.close();
