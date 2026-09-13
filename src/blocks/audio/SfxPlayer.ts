/**
 * SfxPlayer — one-shot SFX via AudioEngine (or silent no-op).
 */
import type { AudioEngine } from '../../engine/audio/AudioEngine';

export class SfxPlayer {
  constructor(
    private audio: AudioEngine,
    private defaultGain = 0.8,
  ) {}

  /** Play a decoded buffer if context exists. */
  play(buf: AudioBuffer | null, gain = this.defaultGain, rate = 1): boolean {
    if (!buf) return false;
    if (!this.audio.context) return false;
    return !!this.audio.playBuffer(buf, gain, rate);
  }

  /** Load then play; silent on failure. */
  async playUrl(url: string, gain = this.defaultGain): Promise<boolean> {
    const buf = await this.audio.load(url);
    return this.play(buf, gain);
  }
}
