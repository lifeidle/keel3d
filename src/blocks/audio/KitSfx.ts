/**
 * KitSfx — play short kit WAV clips without AudioEngine.
 * Creates its own AudioContext on first play (call from a gesture).
 * Silent no-op without DOM/AudioContext. Files live in public/audio/kit/.
 */
export type KitSfxName =
  | 'click'
  | 'pickup'
  | 'hit'
  | 'shoot'
  | 'boom'
  | 'reload'
  | 'win'
  | 'lose'
  | 'place';

const BASE = 'audio/kit/';

export class KitSfx {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Set<string>();
  /** 404 过的名字记下来，避免每次 play 都重新发一次必然失败的请求（控制台刷屏） */
  private failed = new Set<string>();
  private muted = false;
  private vol = 0.45;
  private base = BASE;

  get ready(): boolean {
    return !!this.ctx;
  }

  /**
   * 改素材根路径。仓库内默认 'audio/kit/'（相对页面）；
   * 外部工程若把素材放在别处（CDN / 子目录）可在这里覆盖。
   */
  setBase(base: string): void {
    this.base = base.endsWith('/') ? base : base + '/';
    this.failed.clear();
  }

  setMuted(on: boolean): void {
    this.muted = on;
  }

  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
  }

  /** Fire and forget. Safe in Node / without files. */
  play(name: KitSfxName | string, gain = 1, rate = 1): void {
    if (this.muted || typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
      }
      void this.ctx.resume();
      const buf = this.buffers.get(name);
      if (buf) {
        this.playBuffer(buf, gain, rate);
        return;
      }
      this.load(name).then((b) => {
        if (b) this.playBuffer(b, gain, rate);
      });
    } catch {
      /* silent */
    }
  }

  private playBuffer(buf: AudioBuffer, gain: number, rate: number): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = this.vol * gain;
    src.connect(g);
    g.connect(this.ctx.destination);
    src.start();
  }

  private async load(name: string): Promise<AudioBuffer | null> {
    if (this.failed.has(name)) return null;
    if (!this.ctx || this.loading.has(name)) return this.buffers.get(name) ?? null;
    this.loading.add(name);
    try {
      const res = await fetch(this.base + name + '.wav');
      if (!res.ok) {
        this.failed.add(name);
        return null;
      }
      const raw = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(raw);
      this.buffers.set(name, buf);
      return buf;
    } catch {
      this.failed.add(name);
      return null;
    } finally {
      this.loading.delete(name);
    }
  }

  dispose(): void {
    this.buffers.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}
