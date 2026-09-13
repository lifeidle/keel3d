// (historical provenance note removed — see AUDIO_CREDITS.md)
// with a procedural WebAudio fallback when a sample is missing or the context is suspended.
//
// Event -> one or more sample paths (relative to /public, served at /audio/...).
// Variants are picked at random for natural variation.

type Variant = string[];

const BANK: Record<string, Variant> = {
  // player arsenal (one bank per weapon slot)
  shot_rifle: ['sfx/weapons/sks.wav'],
  shot_carbine: ['sfx/weapons/cz.wav'],
  shot_smg: ['sfx/weapons/cz.wav'],
  shot_bolt: ['sfx/weapons/mosin.wav'],
  // enemy fire (one bank per class archetype)
  enemyShot_rifle: ['sfx/weapons/sks.wav'],
  enemyShot_smg: ['sfx/weapons/cz.wav'],
  enemyShot_sniper: ['sfx/weapons/mosin.wav'],
  // hit confirmation (hitmarker)
  hit: ['sfx/impact/hitmark_a.ogg', 'sfx/impact/hitmark_b.ogg'],
  // body hit on player
  bodyHit: ['sfx/impact/bodyhit_a.ogg', 'sfx/impact/bodyhit_b.ogg'],
  // reload (magazine)
  reload: ['sfx/mechanical/s_mag_a.ogg', 'sfx/mechanical/s_mag_b.ogg'],
  // dry-fire / empty
  empty: ['sfx/mechanical/s_dry_a.ogg', 'sfx/mechanical/s_dry_b.ogg'],
  // footsteps
  step: [
    'sfx/impact/step_a.ogg',
    'sfx/impact/step_b.ogg',
    'sfx/impact/step_c.ogg',
    'sfx/impact/step_d.ogg',
  ],
  // explosion (reserved for later use)
  explosion: ['sfx/weapons/boom_new.wav'],
  // wooden crate splintering (sfx/ui/s_melee is a solid impact thud)
  wood: ['sfx/impact/wood_a.ogg', 'sfx/impact/wood_b.ogg'],
  // main gun (tank cannon) — big distant thud
  cannon: ['sfx/weapons/shotty.wav'],
  // tank reload (bolt closing after a shot)
  tankReload: ['sfx/vehicles/s_tank_reload_a.ogg', 'sfx/vehicles/s_tank_reload_b.ogg'],
  // turret traverse (brief gear grind while aiming)
  turret: ['sfx/vehicles/s_turret_gear_a.ogg', 'sfx/vehicles/s_turret_gear_b.ogg'],
  // bullet pinging off armour / stone
  ricochet: ['sfx/impact/ricochet_a.ogg', 'sfx/impact/ricochet_b.ogg'],
  // battlefield soundscape (atmosphere batch)
  amb_bird: ['sfx/ambience/s_bird_a.ogg'],
  // distant-MG chatter retired with the unprovenanced set — the battle music
  // layer carries that role now
};

/**
 * Voice lines come in TWO languages and follow the UI language. `zh` entries
 * are synthesized locally (Windows SAPI, Huihui — no third-party rights); `en`
 * entries are CC packs from OpenGameArt (see AUDIO_CREDITS.md).
 */
const VOICE_LANG: Record<string, { zh: Variant; en: Variant }> = {
  death: {
    zh: ['sfx/voice_cn/v_cn_down.wav'],
    en: ['sfx/voice_en/wounded.ogg', 'sfx/voice_en/battlecries.ogg'],
  },
  v_tango: {
    zh: ['sfx/voice_cn/v_cn_kill.wav'],
    en: ['sfx/voice_en/04._tango_down.wav'],
  },
  v_enter: {
    zh: ['sfx/voice_cn/v_cn_enter.wav'],
    en: ['sfx/voice_en/26._entering_hostile_territory.wav'],
  },
  v_secured: {
    zh: ['sfx/voice_cn/v_cn_win.wav'],
    en: ['sfx/voice_en/17._objective_secured.wav'],
  },
  v_lost: {
    zh: ['sfx/voice_cn/v_cn_lose.wav'],
    en: ['sfx/voice_en/18._objective_lost.wav'],
  },
  v_losing: {
    zh: ['sfx/voice_cn/v_cn_hold.wav'],
    en: ['sfx/voice_en/15._were_losing_ground.wav'],
  },
  v_nice: {
    zh: ['sfx/voice_cn/v_cn_nice.wav'],
    en: ['sfx/voice_en/v_en_nice.wav'],
  },
  v_follow: {
    zh: ['sfx/voice_cn/v_cn_follow.wav'],
    en: ['sfx/voice_en/v_en_follow.wav'],
  },
  v_assault: {
    zh: ['sfx/voice_cn/v_cn_assault.wav'],
    en: ['sfx/voice_en/v_en_assault.wav'],
  },
  v_guard: {
    zh: ['sfx/voice_cn/v_cn_guard.wav'],
    en: ['sfx/voice_en/v_en_guard.wav'],
  },
  v_lowhp: {
    zh: ['sfx/voice_cn/v_cn_hold.wav'],
    en: ['sfx/voice_en/v_en_guard.wav'],
  },
  v_streak3: {
    zh: ['sfx/voice_cn/v_cn_nice.wav'],
    en: ['sfx/voice_en/v_en_streak3.wav'],
  },
  v_streak5: {
    zh: ['sfx/voice_cn/v_cn_streak5.wav'],
    en: ['sfx/voice_en/v_en_streak5.wav'],
  },
  v_streak8: {
    zh: ['sfx/voice_cn/v_cn_streak8.wav'],
    en: ['sfx/voice_en/v_en_streak8.wav'],
  },
};

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer[]>();
  private loading = false;
  private loaded = false;
  private masterVol = 0.8;
  private sfxMuted = false; // settings toggle: gates buffers, tones and wind
  /** Voice language, follows the UI locale ('zh' | 'en'). */
  private voiceLang: 'zh' | 'en' = 'zh';
  // procedural wind bed (calm soundscape)
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windLfo: OscillatorNode | null = null;
  // vehicle engine: idle drone whose pitch rises with speed
  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  /** Must be called from a user gesture (start-screen click). */
  resume() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVol;
      this.master.connect(this.ctx.destination);
      this.loadBank();
    }
    this.ctx.resume();
  }

  /** Master volume 0..1 (settings slider). */
  setMasterVolume(v: number) {
    this.masterVol = v;
    if (this.master) this.master.gain.value = v;
  }

  /** Which language set playVoice() resolves to (follows the UI locale). */
  setVoiceLang(l: 'zh' | 'en') {
    this.voiceLang = l;
  }

  /** SFX on/off (settings toggle). Wind fades with it; new one-shots are gated. */
  setSfxMuted(on: boolean) {
    this.sfxMuted = on;
    if (this.windGain && this.ctx) {
      this.windGain.gain.setTargetAtTime(on ? 0 : 0.12, this.ctx.currentTime, 0.3);
    }
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(on ? 0 : 0.14, this.ctx.currentTime, 0.3);
    }
  }

  // ---------- vehicle engine ----------

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
    g.gain.setTargetAtTime(this.sfxMuted ? 0 : 0.14, ctx.currentTime, 0.4);
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

  /** Raw context (for sub-mix owners like the music director). */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** Master output node; music routes under it so the volume slider governs everything. */
  get output(): GainNode | null {
    return this.master;
  }

  /** Fetch a small critical set immediately; everything else loads on demand. */
  private async loadBank() {
    if (this.loading || this.loaded) return;
    this.loading = true;
    // Critical: sounds the first shots need. Ambience/voice/vehicles defer.
    const critical = new Set([
      'shot_rifle',
      'shot_carbine',
      'shot_smg',
      'shot_bolt',
      'enemyShot_rifle',
      'enemyShot_smg',
      'enemyShot_sniper',
      'hit',
      'reload',
      'empty',
    ]);
    const entries = Object.entries(BANK).filter(([name]) => critical.has(name));
    await Promise.all(
      entries.map(async ([name, variants]) => {
        const decoded: AudioBuffer[] = [];
        for (const v of variants) {
          try {
            const buf = await this.decode(`audio/${v}`);
            if (buf) decoded.push(buf);
          } catch {
            /* missing sample -> skip */
          }
        }
        if (decoded.length) this.buffers.set(name, decoded);
      })
    );
    // Current language voices only (other language loads when locale flips).
    await this.loadVoiceLang(this.voiceLang);
    this.loaded = true;
    this.loading = false;
    // Warm the rest in the background so later fights have full fat.
    this.warmDeferred();
  }

  private async loadVoiceLang(lang: 'zh' | 'en') {
    await Promise.all(
      Object.entries(VOICE_LANG).map(async ([name, langs]) => {
        const key = `${name}:${lang}`;
        if (this.buffers.has(key)) return;
        const decoded: AudioBuffer[] = [];
        for (const v of langs[lang]) {
          try {
            const buf = await this.decode(`audio/${v}`);
            if (buf) decoded.push(buf);
          } catch {
            /* skip */
          }
        }
        if (decoded.length) this.buffers.set(key, decoded);
      })
    );
  }

  /** Non-blocking background fill of ambience / body-hit / vehicles. */
  private warmDeferred() {
    const skip = new Set([
      'shot_rifle',
      'shot_carbine',
      'shot_smg',
      'shot_bolt',
      'enemyShot_rifle',
      'enemyShot_smg',
      'enemyShot_sniper',
      'hit',
      'reload',
      'empty',
    ]);
    void Promise.all(
      Object.entries(BANK)
        .filter(([name]) => !skip.has(name) && !this.buffers.has(name))
        .map(async ([name, variants]) => {
          const decoded: AudioBuffer[] = [];
          for (const v of variants) {
            try {
              const buf = await this.decode(`audio/${v}`);
              if (buf) decoded.push(buf);
            } catch {
              /* skip */
            }
          }
          if (decoded.length) this.buffers.set(name, decoded);
        })
    );
  }

  /** Ensure a bank key exists (lazy). Safe to call every play. */
  private ensureBank(name: string) {
    if (this.buffers.has(name) || this.loadingKeys.has(name)) return;
    const variants = BANK[name];
    if (!variants) return;
    this.loadingKeys.add(name);
    void (async () => {
      const decoded: AudioBuffer[] = [];
      for (const v of variants) {
        try {
          const buf = await this.decode(`audio/${v}`);
          if (buf) decoded.push(buf);
        } catch {
          /* skip */
        }
      }
      if (decoded.length) this.buffers.set(name, decoded);
      this.loadingKeys.delete(name);
    })();
  }

  private loadingKeys = new Set<string>();

  private async decode(path: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    const res = await fetch(path);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return await this.ctx.decodeAudioData(arr);
  }

  private playBuffer(name: string, gain = 1, pitch = 1) {
    if (!this.ctx || !this.master || this.sfxMuted) return;
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
    // Long-tail clips: the new gun recordings run 7-16 SECONDS (echo bouncing
    // around the valley). Playing them whole meant gunfire kept ringing long
    // after the trigger stopped. Clip shot slots to their 0.5s body; the
    // battle music layer carries the ambient echo instead.
    if (name.startsWith('shot') || name.startsWith('enemyShot')) {
      src.stop(this.ctx.currentTime + 0.5 / pitch);
    }
    return true;
  }

  /**
   * Voice lines play through a light "radio" chain (bandpass around the
   * speech band) so the TTS squad calls and grunts sit in the same comms
   * space as the announcer pack. Consumed from the shared buffer cache and
   * gated by the SFX toggle like every other effect.
   */
  playVoice(name: string, gain = 0.85) {
    if (!this.ctx || !this.master || this.sfxMuted) return;
    const pair = VOICE_LANG[name];
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

  // ---- ambience (atmosphere batch) ----

  /** Far-off machine-gun chatter. The synthetic burst that stood in after the
   *  sample retirement sounded like live gunfire next to the player — removed:
   *  the battle music layer already carries the atmosphere. No-op on purpose,
   *  the call site stays so a real distant-fire sample can slot in later. */
  playDistantMG() {
    void 0; // intentionally silent
  }
  /** Occasional bird call (calm soundscape). */
  playBird() {
    this.playBuffer('amb_bird', 0.24, 0.85 + Math.random() * 0.35);
  }
  /** Distant artillery rumble — the explosion sample, slowed way down. */
  playFarBoom() {
    this.playBuffer('explosion', 0.14, 0.5 + Math.random() * 0.3);
  }
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
    g.gain.setTargetAtTime(0.06, ctx.currentTime, 2.5);
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

  // ---- public events (sample-first, procedural fallback) ----

  playWeaponShot(bank: string) {
    if (this.playBuffer(bank, 0.9)) return;
    this.tone(120, 0.08, 0.3, 'square');
  }
  /** Weapon swap click. */
  playSwitch() {
    this.playBuffer('empty', 0.5);
  }
  playExplosion() {
    if (this.playBuffer('explosion', 1)) return;
    this.noiseBurst(0.6, 300, 0.8);
  }
  /** Kill confirmed: a crisp two-tone rise, clearly distinct from plain hits. */
  playKillConfirm() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const master = this.master;
    const t0 = ctx.currentTime;
    const blip = (freq: number, at: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.09);
      osc.connect(g).connect(master);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.1);
    };
    blip(880, 0);
    blip(1318, 0.07);
  }

  /** Soldier collapsing — a low, close thud (body hits the ground). */
  playBodyDrop() {
    this.playBuffer('wood', 0.42, 0.72);
  }
  playEnemyShot(kind: 'rifle' | 'smg' | 'sniper' = 'smg') {
    this.playBuffer('enemyShot_' + kind, 0.5);
  }
  playHit() {
    if (this.playBuffer('hit', 0.8)) return;
    this.tone(220, 0.05, 0.15, 'sawtooth');
  }
  playEnemyHit() {
    this.playBuffer('hit', 0.6);
  }
  playWoodCrack() {
    if (this.playBuffer('wood', 0.7)) return;
    this.tone(140, 0.08, 0.25, 'square');
  }
  /** Off-road rattle: a muted mechanical clunk at random pitch. */
  playRattle() {
    this.playBuffer('reload', 0.16, 0.65 + Math.random() * 0.5);
  }

  /** Pintle MG on the scout jeep — lighter crack, faster cadence. */
  playJeepMG() {
    this.playBuffer('shot_smg', 0.45, 1.02 + Math.random() * 0.22);
  }

  playReload() {
    if (this.playBuffer('reload', 0.9)) return;
    this.tone(90, 0.05, 0.2);
    setTimeout(() => this.tone(130, 0.05, 0.2), 220);
  }
  playEmpty() {
    if (this.playBuffer('empty', 0.9)) return;
    this.tone(800, 0.03, 0.12, 'square');
  }
  playDeath() {
    this.playVoice('death', 0.9); // enemy grunt (CC-BY pack)
  }
  playPlayerHurt() {
    if (this.playBuffer('bodyHit', 0.9)) return;
    this.noiseBurst(0.2, 600, 0.4);
  }
  playStep() {
    this.playBuffer('step', 0.35, 0.9 + Math.random() * 0.2);
  }

  /** Tank main gun. `near` is true when the player fired (louder). */
  playCannon(near = false) {
    this.playBuffer('cannon', near ? 1 : 0.55, 0.95 + Math.random() * 0.1);
  }

  playTankReload() {
    this.playBuffer('tankReload', 0.8, 0.9 + Math.random() * 0.2);
  }

  /** Short gear-grind while the turret traverses (cooldown-throttled by caller). */
  playTurret() {
    this.playBuffer('turret', 0.25, 1);
  }

  /** Steel-on-armour sparking clank (bullets that can't pen the hull). */
  playArmorClank() {
    if (this.playBuffer('ricochet', 0.7)) return;
    this.tone(1800, 0.04, 0.08, 'square');
  }

  // ---- procedural fallback helpers ----
  private noiseBurst(dur: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass') {
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

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'square') {
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
