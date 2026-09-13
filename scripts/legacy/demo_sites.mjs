import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
for (const [name, url] of [
  ["nightraid", "http://localhost:4188/"],
  ["tower", "http://localhost:4189/tower.html"],
  ["cultivation", "http://localhost:4190/cultivation.html"],
]) {
  const errors = [];
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000);
  const title = await page.title();
  await page.screenshot({ path: `shots/demo_${name}.png` });
  console.log(`${name}: title=${title} errors=${errors.length ? errors.slice(0,2).join("|") : "none"}`);
  await page.close();
}
await b.close();
