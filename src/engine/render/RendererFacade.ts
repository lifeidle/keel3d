/**
 * RendererFacade — owns canvas, resize, dynamic resolution.
 * WebGPU-only (three/webgpu WebGPURenderer). No WebGL fallback: a browser
 * without WebGPU cannot run this framework — boot() rejects with
 * WebGpuRequiredError and callers must surface the error page.
 */
import * as THREE from 'three';
import type { QualityController, QualitySnapshot } from '../quality/QualityController';
import { WebGpuRequiredError } from '../renderer';

export type RenderBackend = 'webgpu';

/** Minimal surface we rely on from three/webgpu WebGPURenderer. */
interface GpuRenderer {
  init(): Promise<void>;
  /** Sync present after init — renderAsync is deprecated in three r186. */
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setPixelRatio(v: number): void;
  setSize(w: number, h: number, updateStyle?: boolean): void;
  dispose(): void;
  domElement: HTMLCanvasElement;
  shadowMap?: { enabled: boolean; type: number; needsUpdate?: boolean };
}

export interface RendererFacadeOptions {
  parent: HTMLElement;
  quality: QualityController;
}

export class RendererFacade {
  private parent: HTMLElement;
  private quality: QualityController;
  private _raw: GpuRenderer | null = null;
  private _backend: RenderBackend = 'webgpu';
  private ready: Promise<void>;
  private disposed = false;

  constructor(opts: RendererFacadeOptions) {
    this.parent = opts.parent;
    this.quality = opts.quality;
    this.ready = this.boot();
    this.quality.onChange(() => this.applySize());
    window.addEventListener('resize', this.onWindowResize);
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  get backend(): RenderBackend {
    return this._backend;
  }

  get raw(): GpuRenderer {
    if (!this._raw) throw new Error('[RendererFacade] not ready');
    return this._raw;
  }

  private async boot(): Promise<void> {
    const q = this.quality.snapshot();
    let gpu: GpuRenderer | null = null;
    try {
      const adapter = await probeWebGPU();
      if (!adapter) throw new WebGpuRequiredError('no WebGPU adapter');
      const mod = await import('three/webgpu');
      const Ctor = (mod as unknown as { WebGPURenderer: new (p?: unknown) => GpuRenderer })
        .WebGPURenderer;
      gpu = new Ctor({ antialias: true, powerPreference: 'high-performance' });
      await gpu.init();
    } catch (err) {
      if (gpu) gpu.dispose();
      if (err instanceof WebGpuRequiredError) throw err;
      throw new WebGpuRequiredError(`WebGPURenderer init failed: ${String(err)}`);
    }

    if (this.disposed) {
      gpu.dispose();
      return;
    }

    this._raw = gpu;
    this._backend = 'webgpu';
    const canvas = gpu.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    this.parent.appendChild(canvas);
    if (gpu.shadowMap) {
      gpu.shadowMap.enabled = q.shadows;
      gpu.shadowMap.type = THREE.PCFShadowMap;
    }
    this.applySize();
    console.info('[RendererFacade] backend=webgpu');
  }

  private onWindowResize = () => this.applySize();

  applySize(): void {
    if (!this._raw) return;
    const w = this.parent.clientWidth || window.innerWidth;
    const h = this.parent.clientHeight || window.innerHeight;
    const s = this.quality.snapshot();
    const pr = s.pixelRatio * s.renderScale;
    this._raw.setPixelRatio(pr);
    this._raw.setSize(w, h);
  }

  setShadows(enabled: boolean, mapSize: number): void {
    if (!this._raw || !this._raw.shadowMap) return;
    this._raw.shadowMap.enabled = enabled;
    this._raw.shadowMap.needsUpdate = true;
    void mapSize;
    this.applySize();
  }

  async render(scene: THREE.Scene, camera: THREE.Camera): Promise<void> {
    if (!this._raw) return;
    this._raw.render(scene, camera);
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('resize', this.onWindowResize);
    if (this._raw) {
      this._raw.dispose();
      this._raw.domElement.remove();
      this._raw = null;
    }
  }
}

async function probeWebGPU(): Promise<unknown | null> {
  try {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) return null;
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return null;
    return await gpu.requestAdapter();
  } catch {
    return null;
  }
}
