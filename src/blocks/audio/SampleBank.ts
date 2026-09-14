/**
 * SampleBank — generic WebAudio sample-bank player.
 *
 * Owns the AudioContext, decodes variant lists per key, plays random
 * variants, offers a bilingual voice bank, a procedural wind bed, and an
 * engine drone. Content games inject their bank tables; named helpers stay
 * in the sample layer as a thin subclass.
 *
 * blocks/ must not import game/ — tables and event names live with content.
 */

export type SampleVariants = string[];
export type SampleBankTable = Record<string, SampleVariants>;
export type VoiceBankTable = Record<string, { zh: SampleVariants; en: SampleVariants }>;

export interface SampleBankOpts {
  /** Keys fetched immediately on resume; the rest warm in the background. */
  criticalKeys?: string[];
  /** Fetch path prefix. Default 'audio/'. */
  basePath?: string;
  /** Played keys starting with one of these are clipped to clipSeconds. */
  clipPrefixes?: string[];
  /** Clip length applied to clipPrefixes keys. Default 0.5. */
  clipSeconds?: number;
  /** Initial master volume 0..1. Default 0.8. */
  masterVolume?: number;
  /** Wind bed target gain (unmuted). Default 0.06. */
  windGain?: number;
  /** Engine drone target gain (unmuted). Default 0.14. */
  engineGain?: number;
}

export class SampleBank {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer[]>();
  private loading = false;
  private loaded = false;
  private loadingKeys = new Set<string>();
  private masterVol: number;
  private sfxMuted = false;
  private voiceLang: 'zh' | 'en' = 'zh';
  // procedural wind bed
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windLfo: OscillatorNode | null = null;
  // vehicle engine drone
  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private readonly critical: Set<string>;
  private readonly basePath: string;
  private readonly clipPrefixes: string[];
  private readonly clipSeconds: number;
  private readonly windLevel: number;
  private readonly engineLevel: number;

  constructor(
    private bank: SampleBankTable,
    private voiceBank: VoiceBankTable = {},
    opts: SampleBankOpts = {},
  ) {
    this.masterVol = opts.masterVolume ?? 0.8;
    this.critical = new Set(opts.criticalKeys ?? []);
    this.basePath = opts.basePath ?? 'audio/';
    this.clipPrefixes = opts.clipPrefixes ?? [];
    this.clipSeconds = opts.clipSeconds ?? 0.5;
    this.windLevel = opts.windGain ?? 0.06;
    this.engineLevel = opts.engineGain ?? 0.14;
  }

  /** Must be called from a user gesture. */
  resume() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVol;
      this.master.connect(this.ctx.destination);
      this.loadBank();
    }
    void this.ctx.resume();
  }

  /** Master volume 0..1. */
  setMasterVolume(v: number) {
    this.masterVol = v;
    if (this.master) this.master.gain.value = v;
  }

  /** Which language set playVoice() resolves to. */
  setVoiceLang(l: 'zh' | 'en') {
    this.voiceLang = l;
  }

  /** SFX on/off. Wind and engine fade with it; new one-shots are gated. */
  setSfxMuted(on: boolean) {
    this.sfxMuted = on;
    if (this.windGain && this.ctx) {
      this.windGain.gain.setTargetAtTime(on ? 0 : this.windLevel * 2, this.ctx.currentTime, 0.3);
    }
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(on ? 0 : this.engineLevel, this.ctx.currentTime, 0.3);
    }
  }

  // ---------- engine drone ----------

  /** Start the engine drone (idempotent). Saw + sub-octave through a lowpass. */
  startEngine() {
    if (!this.ctx || !this.master || this.engineOsc) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 52;
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 26;
    const subG = ctx.createGain();
    subG.gain.value = 0.35;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    filt.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(this.sfxMuted ? 0 : this.engineLevel, ctx.currentTime, 0.4);
    osc.connect(filt);
    sub.connect(subG).connect(filt);
    filt.connect(g).connect(this.master);
    osc.start();
    sub.start();
    this.engineOsc = osc;
    this.engineSub = sub;
    this.engineFilter = filt;
    this.engineGain = g;
  }

  /** Speed drives the drone: idle ~52 Hz up to ~110 Hz at full throttle. */
  setEnginePitch(speedRatio: number) {
    if (!this.engineOsc || !this.engineSub || !this.engineFilter || !this.ctx) return;
    const r = Math.max(0, Math.min(1, speedRatio));
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(52 + r * 58, t, 0.12);
    this.engineSub.frequency.setTargetAtTime(26 + r * 29, t, 0.12);
    this.engineFilter.frequency.setTargetAtTime(320 + r * 480, t, 0.12);
  }

  stopEngine() {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = this.engineOsc;
    const sub = this.engineSub;
    const g = this.engineGain;
    this.engineOsc = null;
    this.engineSub = null;
    this.engineFilter = null;
    this.engineGain = null;
    if (!osc || !sub || !g) return;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    try {
      osc.stop(ctx.currentTime + 1.2);
      sub.stop(ctx.currentTime + 1.2);
    } catch {
      /* already stopped */
    }
  }

  /** Raw context (for sub-mix owners like a score director). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Master output node; music routes under it so the volume slider governs everything. */
  get output(): GainNode | null {
    return this.master;
  }

  // ---------- bank loading ----------

  private async loadBank() {
    if (this.loading || this.loaded) return;
    this.loading = true;
    const entries = Object.entries(this.bank).filter(([name]) => this.critical.has(name));
    await this.decodeEntries(entries);
    await this.loadVoiceLang(this.voiceLang);
    this.loaded = true;
    this.loading = false;
    this.warmDeferred();
  }

  private async decodeEntries(entries: [string, SampleVariants][]) {
    await Promise.all(
      entries.map(async ([name, variants]) => {
        const decoded: AudioBuffer[] = [];
        for (const v of variants) {
          try {
            const buf = await this.decode(`${this.basePath}${v}`);
            if (buf) decoded.push(buf);
          } catch {
            /* missing sample -> skip */
          }
        }
        if (decoded.length) this.buffers.set(name, decoded);
      }),
    );
  }

  private async loadVoiceLang(lang: 'zh' | 'en') {
    await Promise.all(
      Object.entries(this.voiceBank).map(async ([name, langs]) => {
        const key = `${name}:${lang}`;
        if (this.buffers.has(key)) return;
        const decoded: AudioBuffer[] = [];
        for (const v of langs[lang]) {
          try {
            const buf = await this.decode(`${this.basePath}${v}`);
            if (buf) decoded.push(buf);
          } catch {
            /* skip */
          }
        }
        if (decoded.length) this.buffers.set(key, decoded);
      }),
    );
  }

  /** Non-blocking background fill of everything not in the critical set. */
  private warmDeferred() {
    const pending = Object.entries(this.bank).filter(
      ([name]) => !this.critical.has(name) && !this.buffers.has(name),
    );
    void this.decodeEntries(pending);
  }

  /** Ensure a bank key exists (lazy). Safe to call every play. */
  private ensureBank(name: string) {
    if (this.buffers.has(name) || this.loadingKeys.has(name)) return;
    const variants = this.bank[name];
    if (!variants) return;
    this.loadingKeys.add(name);
    void (async () => {
      const decoded: AudioBuffer[] = [];
      for (const v of variants) {
        try {
          const buf = await this.decode(`${this.basePath}${v}`);
          if (buf) decoded.push(buf);
        } catch {
          /* skip */
        }
      }
      if (decoded.length) this.buffers.set(name, decoded);
      this.loadingKeys.delete(name);
    })();
  }

  private async decode(path: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    const res = await fetch(path);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return await this.ctx.decodeAudioData(arr);
  }

  // ---------- public play API ----------

  /**
   * Play a random variant of `name`. Returns false when muted, the context
   * is missing, or no buffer is decoded yet (callers use that for procedural
   * fallback). Optional pitch shifts playback rate.
   */
  play(name: string, gain = 1, pitch = 1): boolean {
    if (!this.ctx || !this.master || this.sfxMuted) return false;
    this.ensureBank(name);
    const list = this.buffers.get(name);
    if (!list || !list.length) return false;
    const buf = list[(Math.random() * list.length) | 0];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start();
    // Long-tail clips: gun recordings can ring for many seconds. Clip
    // configured prefixes so gunfire stops when the trigger does.
    if (this.clipPrefixes.some((p) => name.startsWith(p))) {
      src.stop(this.ctx.currentTime + this.clipSeconds / pitch);
    }
    return true;
  }

  /**
   * Voice lines play through a light bandpass "radio" chain. Consumed from
   * the shared buffer cache and gated by the SFX toggle like every other
   * effect.
   */
  playVoice(name: string, gain = 0.85) {
    if (!this.ctx || !this.master || this.sfxMuted) return;
    const pair = this.voiceBank[name];
    if (pair) {
      const key = `${name}:${this.voiceLang}`;
      if (!this.buffers.has(key)) void this.loadVoiceLang(this.voiceLang);
    }
    const key = pair ? `${name}:${this.voiceLang}` : name;
    const list = this.buffers.get(key);
    if (!list || !list.length) return;
    const ctx = this.ctx;
    const buf = list[(Math.random() * list.length) | 0];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  // ---------- wind bed ----------

  /** Procedural wind bed: looped lowpassed noise with a slow gain swell. */
  startWind() {
    if (!this.ctx || !this.master || this.windSrc) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(filt).connect(g).connect(this.master);
    src.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();
    this.windSrc = src;
    this.windGain = g;
    this.windLfo = lfo;
    g.gain.setTargetAtTime(this.windLevel, ctx.currentTime, 2.5);
  }

  /** Fade the wind bed out. */
  stopWind() {
    if (!this.windSrc || !this.windGain || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 2;
    this.windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.7);
    try {
      this.windSrc.stop(t);
      this.windLfo?.stop(t);
    } catch {
      /* already stopped */
    }
    this.windSrc = null;
    this.windGain = null;
    this.windLfo = null;
  }

  // ---------- procedural fallback helpers (subclass use) ----------

  protected noiseBurst(dur: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass') {
    if (!this.ctx || !this.master || this.sfxMuted) return;
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filt).connect(g).connect(this.master);
    src.start();
  }

  protected tone(freq: number, dur: number, gain: number, type: OscillatorType = 'square') {
    if (!this.ctx || !this.master || this.sfxMuted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }
}
