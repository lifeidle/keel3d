/**
 * AudioEngine — thin generic bus over Web Audio.
 * The Night Raid sample still owns sample banks / voice packs; this class
 * provides master gain, mute, and context lifetime for the framework.
 */
import type { AssetHub } from '../assets/AssetHub';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterVol = 0.8;
  private muted = false;

  constructor(private assets: AssetHub) {}

  /** Must be called from a user gesture. Idempotent. */
  resume(): AudioContext | null {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.masterVol;
      this.master.connect(this.ctx.destination);
      this.assets.useAudioContext(this.ctx);
    }
    void this.ctx.resume();
    return this.ctx;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get output(): GainNode | null {
    return this.master;
  }

  setMasterVolume(v: number): void {
    this.masterVol = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.masterVol;
  }

  setMuted(on: boolean): void {
    this.muted = on;
    if (this.master) this.master.gain.value = on ? 0 : this.masterVol;
  }

  load(url: string): Promise<AudioBuffer | null> {
    return this.assets.loadAudio(url);
  }

  /** One-shot buffer playback into the master bus. */
  playBuffer(buf: AudioBuffer, gain = 1, rate = 1): AudioBufferSourceNode | null {
    if (!this.ctx || !this.master) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start();
    return src;
  }
}
