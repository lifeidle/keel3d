import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const shots = [
  ["tower", "http://localhost:4189/tower.html"],
  ["cultivation", "http://localhost:4190/cultivation.html"],
  ["flight", "http://localhost:4188/?game=flight"],
  ["race", "http://localhost:4188/?game=race"],
  ["nightraid", "http://localhost:4188/"],
];
for (const [name, url] of shots) {
  const errors = [];
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3500);
  if (name === "tower") {
    // place a couple towers for a livelier shot
    await page.keyboard.press("1");
    await page.mouse.click(640, 360);
    await page.waitForTimeout(400);
    await page.keyboard.press("2");
    await page.mouse.click(500, 400);
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: "shots/day_" + name + ".png" });
  console.log(name + " errors: " + (errors.length ? errors.slice(0,2).join("|") : "none"));
  await page.close();
}
await b.close();
