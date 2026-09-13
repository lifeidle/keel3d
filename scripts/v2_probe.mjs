import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const urls = [
  ["nightraid", "http://localhost:4188/"],
  ["tower", "http://localhost:4188/tower.html"],
  ["cultivation", "http://localhost:4188/cultivation.html"],
  ["flight", "http://localhost:4188/?game=flight"],
  ["race", "http://localhost:4188/?game=race"],
  ["template", "http://localhost:4188/?game=template"],
  ["hello", "http://localhost:4188/?game=hello"],
];
for (const [name, url] of urls) {
  const errors = [];
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 180)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 180)); });
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(name === "nightraid" ? 4000 : 2500);
  const hud = await page.evaluate(() => {
    const ids = ["tower-hud","cultivation-hud","flight-hud","race-hud","hud"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.textContent) return id + ":" + el.textContent.slice(0, 60);
    }
    return document.title;
  });
  console.log(name + " | " + hud.replace(/\n/g," ") + " | errors: " + (errors.length ? errors[0].slice(0,80) : "none"));
  await page.close();
}
await b.close();
