// Temp probe: can headless Chrome get a WebGPU adapter with swiftshader?
// NOTE: must evaluate on a secure context (http://localhost) — about:blank lacks navigator.gpu.
import { chromium } from 'playwright';

const argsets = [
  ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'],
  ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan'],
  ['--enable-unsafe-webgpu'],
];

for (const [i, args] of argsets.entries()) {
  const b = await chromium.launch({ headless: true, channel: 'chrome', args });
  const page = await b.newPage();
  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  const res = await page.evaluate(async () => {
    const g = navigator.gpu;
    if (!g) return { hasGpu: false, secure: window.isSecureContext };
    try {
      const a = await g.requestAdapter();
      if (!a) return { hasGpu: true, adapter: null };
      const info = a.info ? { vendor: a.info.vendor, arch: a.info.architecture, device: a.info.device } : {};
      return { hasGpu: true, adapter: info };
    } catch (e) {
      return { hasGpu: true, err: String(e).slice(0, 120) };
    }
  });
  console.log(`ARGSET ${i}:`, JSON.stringify(res), '|', args.join(' '));
  await b.close();
}
