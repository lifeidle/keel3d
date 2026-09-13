// Entry point. Rapier ships as a standalone .wasm (ESM import, ready at module load).
// Boot: Engine kernel owns the rAF loop + system schedule.
// ?game=nightraid (default) | tower | cultivation — samples are independent.
import { Game } from './game/nightraid/game';
import { Engine } from './engine/Engine';
import { QualityController } from './engine/quality/QualityController';
import { createEngineAsync, WebGpuRequiredError } from './engine/renderer';
import { detectQuality } from './world/quality';
import { initI18n, t } from './i18n';
import { prefetchHD } from './game/nightraid/world/phototex';
import { FullscreenUI } from './ui/fullscreen';
import { createNightRaidGame } from './game/nightraid/NightRaidGame';
import { createTowerGame } from './game/demo-tower';
import { createCultivationGame } from './game/demo-cultivation';
import { createTemplateGame } from './game/demo-template';
import { createFlightGame } from './game/demo-flight';
import { createRaceGame } from './game/demo-race';
import type { System } from './engine/types';

const GAME_IDS = ['nightraid', 'tower', 'cultivation', 'template', 'flight', 'race'] as const;
type GameId = (typeof GAME_IDS)[number];

function isGameId(v: string | undefined | null): v is GameId {
  return !!v && (GAME_IDS as readonly string[]).includes(v);
}

function gameFromUrl(): GameId {
  const fromWindow = (window as unknown as { __GAME_ID__?: string }).__GAME_ID__;
  if (isGameId(fromWindow)) return fromWindow;
  const id = new URLSearchParams(location.search).get('game');
  if (isGameId(id)) return id;
  return 'nightraid';
}

/** Present system for samples that reuse the engine's WebGPU canvas. */
function presentSystem(engine: { renderer: { render(s: unknown, c: unknown): void }; scene: unknown; camera: unknown }): System {
  return {
    name: 'sample.present',
    update() {
      engine.renderer.render(engine.scene, engine.camera);
    },
  };
}

async function boot() {
  const fill = document.getElementById('bootFill')!;
  const gameId = gameFromUrl();

  if (gameId === 'nightraid') {
    fill.style.width = '30%';
    prefetchHD();
    fill.style.width = '70%';
  } else {
    fill.style.width = '50%';
  }

  initI18n();
  const fullscreen = new FullscreenUI();

  const app = document.getElementById('app');
  if (!app) throw new Error('#app not found');

  const qualityCtrl = new QualityController(detectQuality());
  const threeEngine = await createEngineAsync(app, qualityCtrl.current);
  const engine = new Engine({ parent: app, qualityCtrl, headless: true });

  if (gameId === 'nightraid') {
    const game = new Game(app, { qualityCtrl, externalLoop: true, engine: threeEngine });
    const module = createNightRaidGame({ game });
    for (const s of module.systems) engine.addSystem(s);
    module.mount(engine);
    fill.style.width = '100%';
    setTimeout(() => {
      document.getElementById('boot')!.classList.add('hidden');
      game.mount();
      engine.start();
      fullscreen.maybePrompt();
    }, 250);
    return;
  }

  // Sample B / C — independent content packages on the same engine canvas.
  engine.addSystem({
    name: 'sample.playing',
    update(_ft, world) {
      world.playing = true;
    },
  });
  if (gameId === 'tower') {
    const sample = createTowerGame({
      scene: threeEngine.scene,
      camera: threeEngine.camera,
    });
    for (const s of sample.systems) engine.addSystem(s);
  } else if (gameId === 'template') {
    const sample = createTemplateGame({
      scene: threeEngine.scene,
      camera: threeEngine.camera,
    });
    for (const s of sample.systems) engine.addSystem(s);
  } else if (gameId === 'flight') {
    const sample = createFlightGame({
      scene: threeEngine.scene,
      camera: threeEngine.camera,
    });
    for (const s of sample.systems) engine.addSystem(s);
  } else if (gameId === 'race') {
    const sample = createRaceGame({
      scene: threeEngine.scene,
      camera: threeEngine.camera,
    });
    for (const s of sample.systems) engine.addSystem(s);
  } else {
    const sample = createCultivationGame({
      scene: threeEngine.scene,
      camera: threeEngine.camera,
    });
    for (const s of sample.systems) engine.addSystem(s);
  }
  engine.addSystem(presentSystem(threeEngine));
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
  if (err instanceof WebGpuRequiredError) {
    if (bootTxt)
      bootTxt.textContent =
        '本框架需要 WebGPU — 请用最新版 Chrome / Edge / Safari(17+) 或开启 Chrome 实验性 WebGPU 后刷新。' +
        ' This framework requires WebGPU — update your browser or refresh.';
    if (fill) fill.style.width = '100%';
  } else if (bootTxt) {
    bootTxt.textContent = t('boot.fail') + ' — ' + String(err);
  }
});
