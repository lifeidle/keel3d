/**
 * Boot: resolve game id → load module from registry → mount via host.
 * Night Raid keeps its full Game menu flow (special path).
 * All other packages: defineGame + mountSampleGame.
 */
import { Engine } from './engine/Engine';
import { QualityController } from './engine/quality/QualityController';
import { createEngineAsync, WebGpuRequiredError } from './engine/renderer';
import { detectQuality } from './world/quality';
import { initI18n, t } from './i18n';
import { prefetchHD } from './blocks/assets/PhotoTex';
import { FullscreenUI } from './ui/fullscreen';
import { resolveGameId, loadGame, DEFAULT_GAME_ID } from './registry';
import { mountSampleGame } from './content/host';
import { bootNightRaid } from './game/nightraid/module';
import type * as THREE from 'three';

async function boot() {
  const fill = document.getElementById('bootFill')!;
  const gameId = resolveGameId();

  if (gameId === 'nightraid') {
    fill.style.width = '30%';
    prefetchHD();
    fill.style.width = '70%';
  } else {
    fill.style.width = '40%';
  }

  initI18n({ setDocumentTitle: gameId === 'nightraid' });
  const fullscreen = new FullscreenUI();

  const app = document.getElementById('app');
  if (!app) throw new Error('#app not found');

  const qualityCtrl = new QualityController(detectQuality());
  const threeEngine = await createEngineAsync(app, qualityCtrl.current);
  const engine = new Engine({ parent: app, qualityCtrl, headless: true });

  // Opt-in debug handle: append ?debug to any demo URL to inspect the live
  // scene graph from the console. Off by default so it never leaks in prod.
  if (typeof window !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { __keel?: unknown }).__keel = {
      scene: threeEngine.scene,
      camera: threeEngine.camera,
      renderer: threeEngine.renderer,
      engine,
    };
  }

  if (gameId === 'nightraid') {
    const nr = bootNightRaid(app, { qualityCtrl, engine: threeEngine });
    for (const s of nr.systems) engine.addSystem(s);
    nr.mount(engine);
    fill.style.width = '100%';
    setTimeout(() => {
      document.getElementById('boot')!.classList.add('hidden');
      nr.game.mount();
      engine.start();
      fullscreen.maybePrompt();
    }, 250);
    return;
  }

  const mod = await loadGame(gameId);
  const render = (scene: THREE.Scene, camera: THREE.Camera) => {
    threeEngine.renderer.render(scene, camera);
  };

  mountSampleGame(mod, {
    engine,
    scene: threeEngine.scene,
    camera: threeEngine.camera,
    sun: threeEngine.moon,
    hemi: threeEngine.hemi,
    parent: app,
    quality: qualityCtrl,
    render,
    // headless engine skips GPU canvas; still offer a shared physics world
    services: {
      physics: engine.services.physics ?? undefined,
      audio: engine.services.audio ?? undefined,
      input: engine.services.input ?? undefined,
    },
  });

  fill.style.width = '100%';
  setTimeout(() => {
    document.getElementById('boot')!.classList.add('hidden');
    engine.start();
  }, 150);
}

boot().catch((err) => {
  console.error(err);
  const bootTxt = document.getElementById('bootTxt');
  const fill = document.getElementById('bootFill');
  if (fill) fill.style.width = '100%';
  if (err instanceof WebGpuRequiredError) {
    if (bootTxt) {
      bootTxt.innerHTML =
        '<div style="max-width:28em;text-align:left;line-height:1.6">' +
        '<strong>需要 WebGPU</strong><br/>' +
        '请使用最新版 Chrome / Edge，或 Safari 17+。<br/>' +
        'Chrome 可打开 <code>chrome://gpu</code> 查看 WebGPU 是否可用。<br/>' +
        '<span style="opacity:.8">This framework requires WebGPU — update your browser.</span>' +
        '</div>';
    }
  } else if (bootTxt) {
    bootTxt.textContent = t('boot.fail') + ' — ' + String(err);
  }
});

void DEFAULT_GAME_ID;
