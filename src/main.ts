// Entry point. Rapier ships as a standalone .wasm (ESM import, ready at module load).
// Boot: Engine kernel owns the rAF loop + system schedule; NightRaid is a
// GameModule whose systems drive the sample combat game.
import { Game } from './game/nightraid/game';
import { Engine } from './engine/Engine';
import { QualityController } from './engine/quality/QualityController';
import { createEngineAsync, WebGpuRequiredError } from './engine/renderer';
import { detectQuality } from './world/quality';
import { initI18n, t } from './i18n';
import { prefetchHD } from './game/nightraid/world/phototex';
import { FullscreenUI } from './ui/fullscreen';
import { createNightRaidGame } from './game/nightraid/NightRaidGame';

async function boot() {
  const fill = document.getElementById('bootFill')!;
  const bootTxt = document.getElementById('bootTxt')!;

  fill.style.width = '30%';
  prefetchHD(); // start HD texture downloads early; menu time covers decoding
  fill.style.width = '70%';

  initI18n();
  const fullscreen = new FullscreenUI();

  const app = document.getElementById('app');
  if (!app) throw new Error('#app not found');

  const qualityCtrl = new QualityController(detectQuality());
  // Live canvas: WebGPU-only (no WebGL fallback — see createEngineAsync).
  const threeEngine = await createEngineAsync(app, qualityCtrl.current);
  // Framework kernel: headless host owns loop order + dynamic-resolution sampling.
  const engine = new Engine({ parent: app, qualityCtrl, headless: true });
  const game = new Game(app, { qualityCtrl, externalLoop: true, engine: threeEngine });
  const module = createNightRaidGame({ game });
  for (const s of module.systems) engine.addSystem(s);
  module.mount(engine);

  fill.style.width = '100%';
  setTimeout(() => {
    document.getElementById('boot')!.classList.add('hidden');
    game.mount(); // reveals the main menu (no rAF — Engine drives)
    engine.start();
    fullscreen.maybePrompt();
  }, 250);
}

boot().catch((err) => {
  console.error(err);
  const bootTxt = document.getElementById('bootTxt');
  const fill = document.getElementById('bootFill');
  if (err instanceof WebGpuRequiredError) {
    // WebGPU-only framework: no silent WebGL fallback — tell the user clearly.
    if (bootTxt)
      bootTxt.textContent =
        '本框架需要 WebGPU — 请用最新版 Chrome / Edge / Safari(17+) 或开启 Chrome 实验性 WebGPU 后刷新。' +
        ' This framework requires WebGPU — update your browser or refresh.';
    if (fill) fill.style.width = '100%';
  } else if (bootTxt) {
    bootTxt.textContent = t('boot.fail') + ' — ' + String(err);
  }
});
