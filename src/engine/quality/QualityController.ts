/**
 * Quality controller: base tier (low/med/high) + dynamic render-scale.
 * Dynamic resolution reacts to sustained frame-time spikes BEFORE dropping
 * a whole quality tier — smoother than hard switching shadows/pixel-ratio.
 */
import { QUALITY, detectQuality, type Quality } from '../../world/quality';

export interface QualitySnapshot {
  tier: Quality;
  renderScale: number; // 0.5 .. 1
  pixelRatio: number;
  shadows: boolean;
  shadowSize: number;
  rainScale: number;
  fogFarMul: number;
  worldDetail: number;
}

const MIN_SCALE = 0.7;
const DEFAULT_SCALE = 1;
/** P95-ish: if smoothed frame time stays above this, start shrinking. */
const FRAME_BUDGET_MS = 22;
const RECOVER_MS = 15.5;
const STEP_DOWN = 0.85;
const STEP_UP = 1.06;
/** Seconds of sustained miss before the first scale cut. */
const HOLD_DOWN_S = 0.45;
const HOLD_UP_S = 1.2;

export class QualityController {
  private tier: Quality = detectQuality();
  private scale = DEFAULT_SCALE;
  private frameMs = 16.7;
  private badTime = 0;
  private goodTime = 0;
  private listeners = new Set<(s: QualitySnapshot) => void>();

  constructor(initial?: Quality) {
    if (initial) this.tier = initial;
  }

  get current(): Quality {
    return this.tier;
  }

  get renderScale(): number {
    return this.scale;
  }

  snapshot(): QualitySnapshot {
    const q = QUALITY[this.tier];
    return {
      tier: this.tier,
      renderScale: this.scale,
      // pixelRatio already capped by tier; renderScale multiplies drawing buffer
      pixelRatio: Math.min(
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
        q.pixelRatio
      ),
      shadows: q.shadows,
      shadowSize: q.shadowSize,
      rainScale: q.rainScale,
      fogFarMul: q.fogFarMul,
      worldDetail: q.worldDetail,
    };
  }

  onChange(fn: (s: QualitySnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setTier(tier: Quality): void {
    if (this.tier === tier) return;
    this.tier = tier;
    this.scale = DEFAULT_SCALE;
    this.notify();
  }

  /** Feed once per render frame with instantaneous frame time in ms. */
  sampleFrame(ms: number): void {
    // EMA — cheap stand-in for a percentile, good enough for control.
    this.frameMs += (ms - this.frameMs) * 0.12;
    if (this.frameMs > FRAME_BUDGET_MS) {
      this.badTime += ms / 1000;
      this.goodTime = 0;
      if (this.badTime >= HOLD_DOWN_S && this.scale > MIN_SCALE + 0.001) {
        this.scale = Math.max(MIN_SCALE, this.scale * STEP_DOWN);
        this.badTime = 0;
        this.notify();
      }
    } else if (this.frameMs < RECOVER_MS) {
      this.goodTime += ms / 1000;
      this.badTime = 0;
      if (this.goodTime >= HOLD_UP_S && this.scale < DEFAULT_SCALE - 0.001) {
        this.scale = Math.min(DEFAULT_SCALE, this.scale * STEP_UP);
        this.goodTime = 0;
        this.notify();
      }
    } else {
      this.badTime = Math.max(0, this.badTime - ms / 2000);
      this.goodTime = 0;
    }
  }

  /** Effective drawing-buffer size for the current window. */
  bufferSize(w: number, h: number): { width: number; height: number } {
    const pr = this.snapshot().pixelRatio * this.scale;
    return {
      width: Math.max(1, Math.floor(w * pr)),
      height: Math.max(1, Math.floor(h * pr)),
    };
  }

  private notify(): void {
    const s = this.snapshot();
    for (const fn of this.listeners) fn(s);
  }
}
