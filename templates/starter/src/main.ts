/**
 * 引导：建 WebGPU 引擎并把 game.ts 的内容包挂上去。
 * `createHost` / `bootGame` 由框架提供，外部项目不需要自己接线渲染循环。
 */
import { bootGame, createHost, WebGpuRequiredError } from 'keel3d';
import game from './game';

try {
  const host = await createHost();
  await bootGame(game, host);
} catch (err) {
  const txt = document.getElementById('bootTxt');
  const fill = document.getElementById('bootFill');
  if (fill) fill.style.width = '100%';
  if (txt) {
    txt.innerHTML =
      err instanceof WebGpuRequiredError
        ? '<strong>需要 WebGPU</strong><br/>请使用最新版 Chrome / Edge，或 Safari 17+。'
        : '启动失败：' + String(err);
  }
  console.error(err);
}
