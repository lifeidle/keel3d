// MusicDirector: adaptive combat soundtrack from fully licensed tracks
// (public/audio/music — see docs/AUDIO_CREDITS.md). The calm/tense/battle loops
// crossfade with combat intensity, and victory/defeat one-shots close the
// round. All audio routes under the master gain so the volume slider governs
// it too.
//
// Tracks (all free for commercial use):
//   layer_battle.mp3  "Open Warfare"    — Ruskerdax (OpenGameArt, CC0)
//   layer_tense.mp3   "Crypto"          — Kevin MacLeod (incompetech, CC-BY 4.0)
//   layer_calm.mp3    "Long Note Two"   — Kevin MacLeod (incompetech, CC-BY 4.0)
//   jingle_*.ogg      Music Jingles     — Kenney (kenney.nl, CC0)
import { Audio } from '../audio/audio';

export type Mood = 'calm' | 'tense' | 'battle';

const MOODS: Mood[] = ['calm', 'tense', 'battle'];
const FADE = 1.6; // mood crossfade seconds

interface Loop {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class MusicDirector {
  private busGain: GainNode | null = null;
  private loops = new Map<Mood, Loop>();
  private moodBufs = new Map<Mood, AudioBuffer>();
  private oneShots = new Map<string, AudioBuffer>(); // stinger / win / defeat
  private mood: Mood | null = null;
  private pending: Mood = 'calm';
  private loadToken = 0;
  private baseVol = 0.5;
  private ducked = false;
  private muted = false; // BGM settings toggle (bus gain is the single switch)
  private menuLoop: Loop | null = null;
  private menuBuf: AudioBuffer | null = null;

  constructor(private audio: Audio) {}

  /** Begin the round soundtrack (async load; loops start once decoded). */
  startRound(_seed: number) {
    this.stopMenu(0.4);
    this.mood = null;
    this.pending = 'calm';
    const token = ++this.loadToken;
    this.stopLoops(0.05);
    void this.loadRound().then(() => {
      if (token === this.loadToken) this.startLoops();
    });
  }

  /** Crossfade to a combat mood (lazy-loads the multi-MB battle layer). */
  setMood(m: Mood) {
    if (m === this.mood) return;
    this.pending = m;
    if (!this.moodBufs.has(m)) {
      // Hold the current bed until the new layer is decoded — never fade to silence.
      void this.decode(`audio/music/layer_${m}.mp3`).then((b) => {
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
    const ctx = this.audio.context;
    const bus = this.getBus();
    if (!ctx || !bus) return;
    // Ensure a loop exists for the target mood (it may have lazy-loaded late).
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
      loop.gain.gain.linearRampToValueAtTime(target, now + FADE);
    }
    this.mood = m;
  }

  /**
   * Main-menu theme: a soft loop under the menus. Idempotent, and it needs the
   * AudioContext to exist — the game calls this after the first user gesture
   * (autoplay policy blocks sound on cold page load).
   */
  startMenu() {
    const ctx = this.audio.context;
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
      this.applyDuck(); // re-apply mute/duck now that the bus exists
    };
    if (this.menuBuf) finish(this.menuBuf);
    else
      void this.decode('audio/music/menu.mp3').then((b) => {
        this.menuBuf = b;
        finish(b);
      });
  }

  /** Fade the menu theme out (a match is starting). */
  stopMenu(fade = 0.8) {
    const ctx = this.audio.context;
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

  /** BGM on/off from settings — the bus gain is the single switch. */
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

  // ---------- internals ----------

  private playEnd(kind: 'win' | 'defeat') {
    this.loadToken++; // invalidate any pending loop start
    this.stopLoops(0.5);
    const token = this.loadToken;
    void this.loadRound().then(() => {
      if (token !== this.loadToken) return;
      this.applyDuck();
      void this.playOneShot(kind, 0.9);
    });
  }

  private getBus(): GainNode | null {
    const ctx = this.audio.context;
    const out = this.audio.output;
    if (!ctx || !out) return null;
    if (!this.busGain) {
      this.busGain = ctx.createGain();
      // honour the persisted mute state: the bus can come to life AFTER the
      // player has already toggled music off in settings (ctx is lazily
      // created on the first gesture)
      this.busGain.gain.value = this.muted ? 0 : this.baseVol;
      this.busGain.connect(out);
    }
    return this.busGain;
  }

  private applyDuck() {
    const bus = this.getBus();
    const ctx = this.audio.context;
    if (!bus || !ctx) return;
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    const level = this.baseVol * (this.ducked ? 0.25 : 1) * (this.muted ? 0 : 1);
    bus.gain.linearRampToValueAtTime(level, now + 0.4);
  }

  private stopLoops(fade: number) {
    const ctx = this.audio.context;
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
    const ctx = this.audio.context;
    if (!ctx) return;
    const jobs: Promise<void>[] = [];
    // Only the calm bed + stinger up front — tense/battle are multi-MB and
    // load on the first setMood() call.
    if (!this.moodBufs.has('calm')) {
      jobs.push(
        this.decode('audio/music/layer_calm.mp3').then((b) => {
          if (b) this.moodBufs.set('calm', b);
        })
      );
    }
    for (const name of ['stinger', 'win', 'defeat']) {
      if (this.oneShots.has(name)) continue;
      jobs.push(
        this.decode(`audio/music/jingle_${name === 'stinger' ? 'stinger' : name}.ogg`).then((b) => {
          if (b) this.oneShots.set(name, b);
        })
      );
    }
    await Promise.all(jobs);
  }

  private async decode(path: string): Promise<AudioBuffer | null> {
    const ctx = this.audio.context;
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
    const ctx = this.audio.context;
    const bus = this.getBus();
    if (!ctx || !bus) return;
    // If the pending mood hasn't decoded yet, fall back to the first available
    // layer so the round never starts in silence.
    let active = this.pending;
    if (!this.moodBufs.has(active)) {
      active = (['calm', 'tense', 'battle'] as Mood[]).find((m) => this.moodBufs.has(m)) ?? 'calm';
    }
    for (const m of MOODS) {
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
    const ctx = this.audio.context;
    if (!ctx) return;
    const token = this.loadToken;
    await this.loadRound();
    if (token !== this.loadToken) return;
    const buf = this.oneShots.get(name);
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
