/**
 * ScoreDirector — adaptive multi-layer soundtrack with mood crossfade.
 *
 * Generic crossfade engine: inject the host (context + master output) and
 * track URLs. Content owns mood names, file paths, and one-shot jingles.
 * Loops route under the host output so a master volume slider governs them.
 */

/** Minimal audio host: anything exposing a context and a master output node. */
export interface AudioHost {
  readonly context: AudioContext | null;
  readonly output: GainNode | null;
}

export interface ScoreDirectorOpts<M extends string = string> {
  /** Mood layer names, in start priority order. */
  moods: M[];
  /** URL for a mood loop layer. */
  moodUrl: (mood: M) => string;
  /** Main-menu theme URL. */
  menuUrl: string;
  /** End/stinger one-shot URLs keyed by logical name. */
  oneShots: Record<string, string>;
  /** Mood crossfade seconds. Default 1.6. */
  fadeSeconds?: number;
  /** Bus base volume. Default 0.5. */
  baseVolume?: number;
  /** Moods preloaded at round start (others lazy-load on setMood). Default first mood. */
  preloadMoods?: M[];
  /** One-shot names loaded at round start. Default all keys of oneShots. */
  preloadOneShots?: string[];
}

interface Loop {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class ScoreDirector<M extends string = string> {
  private busGain: GainNode | null = null;
  private loops = new Map<string, Loop>();
  private moodBufs = new Map<string, AudioBuffer>();
  private oneShotBufs = new Map<string, AudioBuffer>();
  private mood: M | null = null;
  private pending: M;
  private loadToken = 0;
  private baseVol: number;
  private fade: number;
  private ducked = false;
  private muted = false;
  private menuLoop: Loop | null = null;
  private menuBuf: AudioBuffer | null = null;

  constructor(
    private host: AudioHost,
    private opts: ScoreDirectorOpts<M>,
  ) {
    this.baseVol = opts.baseVolume ?? 0.5;
    this.fade = opts.fadeSeconds ?? 1.6;
    this.pending = opts.moods[0] ?? ('' as M);
  }

  /** Begin the round soundtrack (async load; loops start once decoded). */
  startRound(_seed?: number) {
    this.stopMenu(0.4);
    this.mood = null;
    this.pending = this.opts.moods[0] ?? ('' as M);
    const token = ++this.loadToken;
    this.stopLoops(0.05);
    void this.loadRound().then(() => {
      if (token === this.loadToken) this.startLoops();
    });
  }

  /** Crossfade to a mood (lazy-loads multi-MB layers on demand). */
  setMood(m: M) {
    if (m === this.mood) return;
    this.pending = m;
    if (!this.moodBufs.has(m)) {
      // Hold the current bed until the new layer is decoded — never fade to silence.
      void this.decode(this.opts.moodUrl(m)).then((b) => {
        if (b) this.moodBufs.set(m, b);
        if (this.pending === m && this.loops.size) this.applyPendingMood();
      });
      return;
    }
    if (!this.loops.size) return;
    this.applyPendingMood();
  }

  private applyPendingMood() {
    const m = this.pending;
    const ctx = this.host.context;
    const bus = this.getBus();
    if (!ctx || !bus) return;
    if (!this.loops.has(m)) {
      const buf = this.moodBufs.get(m);
      if (buf) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(g).connect(bus);
        src.start();
        this.loops.set(m, { src, gain: g });
      }
    }
    const now = ctx.currentTime;
    for (const [k, loop] of this.loops) {
      const target = k === m ? 1 : 0;
      loop.gain.gain.cancelScheduledValues(now);
      loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
      loop.gain.gain.linearRampToValueAtTime(target, now + this.fade);
    }
    this.mood = m;
  }

  /**
   * Main-menu theme: a soft loop under the menus. Idempotent, and it needs
   * the AudioContext to exist — call after the first user gesture.
   */
  startMenu() {
    const ctx = this.host.context;
    const bus = this.getBus();
    if (!ctx || !bus || this.menuLoop) return;
    const token = ++this.loadToken;
    this.stopLoops(0.3);
    const finish = (buf: AudioBuffer | null) => {
      if (!buf || token !== this.loadToken || this.menuLoop) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 1.4);
      src.connect(gain).connect(bus);
      src.start();
      this.menuLoop = { src, gain };
      this.applyDuck();
    };
    if (this.menuBuf) finish(this.menuBuf);
    else
      void this.decode(this.opts.menuUrl).then((b) => {
        this.menuBuf = b;
        finish(b);
      });
  }

  /** Fade the menu theme out (a match is starting). */
  stopMenu(fade = 0.8) {
    const ctx = this.host.context;
    const loop = this.menuLoop;
    this.menuLoop = null;
    if (!ctx || !loop) return;
    const now = ctx.currentTime;
    loop.gain.gain.cancelScheduledValues(now);
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
    loop.gain.gain.linearRampToValueAtTime(0, now + fade);
    try {
      loop.src.stop(now + fade + 0.05);
    } catch {
      /* already stopped */
    }
  }

  get menuPlaying() {
    return !!this.menuLoop;
  }

  /** Current mood ('' before the first mood has been applied). */
  get moodName(): M | null {
    return this.mood;
  }

  /** BGM on/off — the bus gain is the single switch. */
  setMuted(on: boolean) {
    this.muted = on;
    this.applyDuck();
  }

  /** Duck under the pause screen; restore on resume. */
  setPaused(p: boolean) {
    this.ducked = p;
    this.applyDuck();
  }

  /** Short round-start sting. */
  playStinger() {
    void this.playOneShot('stinger', 0.8);
  }

  /** End-of-round music; loops fade out first. */
  playWin() {
    this.playEnd('win');
  }
  playLose() {
    this.playEnd('defeat');
  }

  /** Fade + drop all loops (e.g. back to the main menu). */
  stop() {
    this.loadToken++;
    this.stopLoops(0.6);
  }

  /**
   * Tear everything down (R47): stop loops/menu, forget buffers, drop the
   * bus. Safe without a context and safe to call twice.
   */
  dispose() {
    this.loadToken++;
    this.stopLoops(0.15);
    this.stopMenu(0.15);
    this.moodBufs.clear();
    this.oneShotBufs.clear();
    this.menuBuf = null;
    this.mood = null;
    this.busGain?.disconnect();
    this.busGain = null;
    this.ducked = false;
  }

  // ---------- internals ----------

  private playEnd(kind: string) {
    this.loadToken++;
    this.stopLoops(0.5);
    const token = this.loadToken;
    void this.loadRound().then(() => {
      if (token !== this.loadToken) return;
      this.applyDuck();
      void this.playOneShot(kind, 0.9);
    });
  }

  private getBus(): GainNode | null {
    const ctx = this.host.context;
    const out = this.host.output;
    if (!ctx || !out) return null;
    if (!this.busGain) {
      this.busGain = ctx.createGain();
      // honour the persisted mute state: the bus can come to life AFTER the
      // player has already toggled music off in settings
      this.busGain.gain.value = this.muted ? 0 : this.baseVol;
      this.busGain.connect(out);
    }
    return this.busGain;
  }

  private applyDuck() {
    const bus = this.getBus();
    const ctx = this.host.context;
    if (!bus || !ctx) return;
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    const level = this.baseVol * (this.ducked ? 0.25 : 1) * (this.muted ? 0 : 1);
    bus.gain.linearRampToValueAtTime(level, now + 0.4);
  }

  private stopLoops(fade: number) {
    const ctx = this.host.context;
    if (!ctx) {
      this.loops.clear();
      return;
    }
    const now = ctx.currentTime;
    for (const [, loop] of this.loops) {
      try {
        loop.gain.gain.cancelScheduledValues(now);
        loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
        loop.gain.gain.linearRampToValueAtTime(0, now + fade);
        loop.src.stop(now + fade + 0.05);
      } catch {
        /* already stopped */
      }
    }
    this.loops.clear();
    this.mood = null;
  }

  private async loadRound() {
    const ctx = this.host.context;
    if (!ctx) return;
    const jobs: Promise<void>[] = [];
    const preload =
      this.opts.preloadMoods ?? (this.opts.moods.slice(0, 1) as M[]);
    for (const m of preload) {
      if (this.moodBufs.has(m)) continue;
      jobs.push(
        this.decode(this.opts.moodUrl(m)).then((b) => {
          if (b) this.moodBufs.set(m, b);
        }),
      );
    }
    const shots = this.opts.preloadOneShots ?? Object.keys(this.opts.oneShots);
    for (const name of shots) {
      if (this.oneShotBufs.has(name)) continue;
      const url = this.opts.oneShots[name];
      if (!url) continue;
      jobs.push(
        this.decode(url).then((b) => {
          if (b) this.oneShotBufs.set(name, b);
        }),
      );
    }
    await Promise.all(jobs);
  }

  private async decode(path: string): Promise<AudioBuffer | null> {
    const ctx = this.host.context;
    if (!ctx) return null;
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  private startLoops() {
    const ctx = this.host.context;
    const bus = this.getBus();
    if (!ctx || !bus) return;
    // If the pending mood hasn't decoded yet, fall back to the first available
    // layer so the round never starts in silence.
    let active = this.pending;
    if (!this.moodBufs.has(active)) {
      active = this.opts.moods.find((m) => this.moodBufs.has(m)) ?? this.opts.moods[0];
    }
    for (const m of this.opts.moods) {
      const buf = this.moodBufs.get(m);
      if (!buf || this.loops.has(m)) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = m === active ? 1 : 0;
      src.connect(g).connect(bus);
      src.start();
      this.loops.set(m, { src, gain: g });
    }
    this.mood = active;
    this.pending = active;
    this.applyDuck();
  }

  private async playOneShot(name: string, gain: number) {
    const ctx = this.host.context;
    if (!ctx) return;
    const token = this.loadToken;
    await this.loadRound();
    if (token !== this.loadToken) return;
    const buf = this.oneShotBufs.get(name);
    const bus = this.getBus();
    if (!buf || !bus) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(bus);
    src.start();
  }
}
