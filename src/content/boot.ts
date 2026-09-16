/**
 * bootGame / createHost — 宿主引导：把「建引擎 → 挂载内容包 → 启动循环」收成两步。
 *
 * 仓库内的 `src/main.ts` 与仓库外的起步模板都走这里，保证两条路径行为一致；
 * 外部项目因此不需要重新实现画布、质量档位、渲染适配那一套。
 *
 * 仓库外典型用法：
 *   import { createHost, bootGame } from 'keel3d';
 *   import game from './game';
 *   bootGame(game, await createHost());
 *
 * 需要自己接管部分流程时（例如特殊启动路径），可以先 `createHost()`，
 * 再用 `host.engine` / `host.three` / `host.dom` 自行装配，最后 `host.start()`。
 */
import { Engine } from '../engine/Engine';
import { QualityController } from '../engine/quality/QualityController';
import { createEngineAsync } from '../engine/renderer';
import { detectQuality } from '../world/quality';
import { initI18n } from '../i18n';
import { mountSampleGame, type MountedSample } from './host';
import type { DefinedGame } from './defineGame';
import type * as THREE from 'three';

/** 引导过程中的 DOM 挂点，全部可覆盖（默认对应仓库内的骨架 HTML）。 */
export interface BootDom {
  /** 画布父节点（默认 `#app`） */
  app?: HTMLElement | null;
  /** 启动进度条填充（默认 `#bootFill`） */
  fill?: HTMLElement | null;
  /** 启动浮层，挂载完成后加 `.hidden`（默认 `#boot`） */
  boot?: HTMLElement | null;
}

export interface BootOptions extends BootDom {
  /**
   * 是否让 i18n 接管 document.title（默认 **false**）。
   * 默认 false 是刻意的：外部工程的页面标题应由自己的 HTML / 游戏名决定，
   * 不该被框架的 i18n 默认标题覆盖。仓库内 nightraid 会显式传 true。
   */
  setDocumentTitle?: boolean;
  /** 追加 `?debug` 时把引擎挂到 window.__keel，便于控制台调试（默认 true） */
  debugHandle?: boolean;
  /** 建引擎前把进度条设到的宽度（默认 '40%'） */
  initialProgress?: string;
}

/** 已建好的宿主：引擎 + 渲染适配 + DOM 挂点。 */
export interface Host {
  /** app 一定存在（createHost 找不到会抛错）；fill/boot 可缺省 */
  dom: { app: HTMLElement; fill: HTMLElement | null; boot: HTMLElement | null };
  quality: QualityController;
  three: Awaited<ReturnType<typeof createEngineAsync>>;
  engine: Engine;
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** 隐藏启动浮层并启动引擎主循环 */
  start(delayMs?: number): void;
}

export interface BootedGame extends Host {
  mounted: MountedSample;
}

function pick<T extends HTMLElement>(el: T | null | undefined, id: string): T | null {
  if (el) return el;
  return typeof document !== 'undefined' ? (document.getElementById(id) as T | null) : null;
}

/** 建 WebGPU 引擎并准备 DOM 挂点，但**不**挂载任何内容包。 */
export async function createHost(opts: BootOptions = {}): Promise<Host> {
  const app = pick(opts.app, 'app');
  if (!app) throw new Error('[keel3d] 找不到画布父节点（#app）');

  const fill = pick(opts.fill, 'bootFill');
  const boot = pick(opts.boot, 'boot');
  if (fill) fill.style.width = opts.initialProgress ?? '40%';

  initI18n({ setDocumentTitle: opts.setDocumentTitle === true });

  const quality = new QualityController(detectQuality());
  const three = await createEngineAsync(app, quality.current);
  const engine = new Engine({ parent: app, qualityCtrl: quality, headless: true });

  // Opt-in debug handle: append ?debug to inspect the live scene graph.
  if (
    opts.debugHandle !== false &&
    typeof window !== 'undefined' &&
    new URLSearchParams(location.search).has('debug')
  ) {
    (window as unknown as { __keel?: unknown }).__keel = {
      scene: three.scene,
      camera: three.camera,
      renderer: three.renderer,
      engine,
    };
  }

  const host: Host = {
    dom: { app, fill, boot },
    quality,
    three,
    engine,
    scene: three.scene,
    camera: three.camera,
    start(delayMs = 150) {
      if (fill) fill.style.width = '100%';
      setTimeout(() => {
        boot?.classList.add('hidden');
        engine.start();
      }, delayMs);
    },
  };
  return host;
}

/** 把内容包挂到宿主上并启动。 */
export async function bootGame(game: DefinedGame, host: Host, delayMs = 150): Promise<BootedGame> {
  const { three, engine, quality } = host;
  const mounted = mountSampleGame(game, {
    engine,
    scene: three.scene,
    camera: three.camera,
    sun: three.moon,
    hemi: three.hemi,
    parent: host.dom.app,
    quality,
    three: host.three,
    render: (scene: THREE.Scene, camera: THREE.Camera) => three.renderer.render(scene, camera),
    // headless engine skips GPU canvas; still offer a shared physics world
    services: {
      physics: engine.services.physics ?? undefined,
      audio: engine.services.audio ?? undefined,
      input: engine.services.input ?? undefined,
    },
  });
  host.start(delayMs);
  return { ...host, mounted };
}
