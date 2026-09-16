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
const TIER_ORDER: Quality[] = ['low', 'med', 'high'];

export interface QualityControllerOpts {
  /**
   * Allow the tier to drop automatically once renderScale is exhausted at
   * the floor and frame time is still over budget. Conservative by design:
   * automatic tier changes only go DOWN; recovery is manual (setTier) or on
   * the next boot (detectQuality). Default true.
   */
  autoTier?: boolean;
  /** Sustained over-budget seconds (at scale floor) before a tier drop. */
  tierDownHoldSec?: number;
}

export class QualityController {
  private tier: Quality = detectQuality();
  private scale = DEFAULT_SCALE;
  private frameMs = 16.7;
  private badTime = 0;
  private goodTime = 0;
  private tierDropTime = 0;
  private listeners = new Set<(s: QualitySnapshot) => void>();
  private opts: Required<QualityControllerOpts>;

  constructor(initial?: Quality, opts: QualityControllerOpts = {}) {
    if (initial) this.tier = initial;
    this.opts = { autoTier: true, tierDownHoldSec: 2.5, ...opts };
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
    this.tierDropTime = 0;
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
      // Tier fallback: renderScale is exhausted at the floor AND frame time
      // is still over budget — drop a whole tier (scale resets via setTier).
      // Only downward; the player (or next boot) can bring it back up.
      const tierIdx = TIER_ORDER.indexOf(this.tier);
      if (this.opts.autoTier && tierIdx > 0 && this.scale <= MIN_SCALE + 0.001) {
        this.tierDropTime += ms / 1000;
        if (this.tierDropTime >= this.opts.tierDownHoldSec) {
          this.setTier(TIER_ORDER[tierIdx - 1]);
          this.tierDropTime = 0;
        }
      }
    } else if (this.frameMs < RECOVER_MS) {
      this.goodTime += ms / 1000;
      this.badTime = 0;
      this.tierDropTime = 0;
      if (this.goodTime >= HOLD_UP_S && this.scale < DEFAULT_SCALE - 0.001) {
        this.scale = Math.min(DEFAULT_SCALE, this.scale * STEP_UP);
        this.goodTime = 0;
        this.notify();
      }
    } else {
      this.badTime = Math.max(0, this.badTime - ms / 2000);
      this.goodTime = 0;
      this.tierDropTime = 0;
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
