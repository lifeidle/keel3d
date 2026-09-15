/**
 * Boot: resolve game id → load module from registry → mount via host.
 *
 * Night Raid keeps its full Game menu flow (special boot path).
 * Every other package goes through `bootGame()` from content/boot — the same
 * path an external project uses, so both stay behaviourally identical.
 */
import { t } from './i18n';
import { WebGpuRequiredError } from './engine/renderer';
import { prefetchHD } from './blocks/assets/PhotoTex';
import { FullscreenUI } from './ui/fullscreen';
import { resolveGameId, loadGame, DEFAULT_GAME_ID } from './registry';
import { createHost, bootGame } from './content/boot';
import { bootNightRaid } from './game/nightraid/module';

async function boot() {
  const gameId = resolveGameId();
  const isNightRaid = gameId === 'nightraid';
  const fill = document.getElementById('bootFill');

  if (isNightRaid) {
    if (fill) fill.style.width = '30%';
    prefetchHD();
    if (fill) fill.style.width = '70%';
  }

  const host = await createHost({
    setDocumentTitle: isNightRaid,
    initialProgress: isNightRaid ? '70%' : '40%',
  });
  const fullscreen = new FullscreenUI();

  if (isNightRaid) {
    const nr = bootNightRaid(host.dom.app, { qualityCtrl: host.quality, engine: host.three });
    for (const s of nr.systems) host.engine.addSystem(s);
    nr.mount(host.engine);
    if (fill) fill.style.width = '100%';
    setTimeout(() => {
      document.getElementById('boot')!.classList.add('hidden');
      nr.game.mount();
      host.engine.start();
      fullscreen.maybePrompt();
    }, 250);
    return;
  }

  await bootGame(await loadGame(gameId), host);
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
