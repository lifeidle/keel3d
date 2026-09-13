/**
 * BgmLayers — two-layer crossfade (calm / intense) on an AudioContext.
 * Creates its own gain nodes; caller feeds buffers or oscillators.
 */
export class BgmLayers {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private calmGain: GainNode | null = null;
  private intenseGain: GainNode | null = null;
  private calmSrc: AudioBufferSourceNode | null = null;
  private intenseSrc: AudioBufferSourceNode | null = null;
  private intensity = 0;

  /** Attach context (user gesture). Idempotent. */
  attach(ctx: AudioContext, destination?: AudioNode): void {
    if (this.ctx === ctx) return;
    this.detach();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(destination ?? ctx.destination);
    this.calmGain = ctx.createGain();
    this.intenseGain = ctx.createGain();
    this.calmGain.connect(this.master);
    this.intenseGain.connect(this.master);
    this.applyIntensity();
  }

  get attached(): boolean {
    return !!this.ctx;
  }

  setCalm(buf: AudioBuffer | null): void {
    if (!this.ctx || !this.calmGain) return;
    this.calmSrc?.stop();
    this.calmSrc = null;
    if (!buf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.connect(this.calmGain);
    s.start();
    this.calmSrc = s;
  }

  setIntense(buf: AudioBuffer | null): void {
    if (!this.ctx || !this.intenseGain) return;
    this.intenseSrc?.stop();
    this.intenseSrc = null;
    if (!buf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.connect(this.intenseGain);
    s.start();
    this.intenseSrc = s;
  }

  /** 0 = all calm, 1 = all intense. */
  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
    this.applyIntensity();
  }

  getIntensity(): number {
    return this.intensity;
  }

  setMasterVolume(v: number): void {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  stop(): void {
    try {
      this.calmSrc?.stop();
      this.intenseSrc?.stop();
    } catch {
      /* already stopped */
    }
    this.calmSrc = null;
    this.intenseSrc = null;
  }

  detach(): void {
    this.stop();
    this.calmGain?.disconnect();
    this.intenseGain?.disconnect();
    this.master?.disconnect();
    this.ctx = null;
    this.master = this.calmGain = this.intenseGain = null;
  }

  private applyIntensity(): void {
    if (!this.calmGain || !this.intenseGain) return;
    this.calmGain.gain.value = 1 - this.intensity;
    this.intenseGain.gain.value = this.intensity;
  }
}
