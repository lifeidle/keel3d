// (historical provenance note removed — see docs/AUDIO_CREDITS.md)
// with a procedural WebAudio fallback when a sample is missing or the context is suspended.
//
// Event -> one or more sample paths (relative to /public, served at /audio/...).
// Variants are picked at random for natural variation.
//
// Generic engine lives in blocks/audio/SampleBank; this file keeps the
// nightraid bank tables and named event helpers.

import { SampleBank, type SampleBankTable, type VoiceBankTable } from '../../../blocks/audio/SampleBank';

const BANK: SampleBankTable = {
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
 * entries are CC packs from OpenGameArt (see docs/AUDIO_CREDITS.md).
 */
const VOICE_LANG: VoiceBankTable = {
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

/** Critical: sounds the first shots need. Ambience/voice/vehicles defer. */
const CRITICAL_KEYS = [
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
];

export class Audio extends SampleBank {
  constructor() {
    super(BANK, VOICE_LANG, {
      criticalKeys: CRITICAL_KEYS,
      clipPrefixes: ['shot', 'enemyShot'],
      clipSeconds: 0.5,
    });
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
    this.play('amb_bird', 0.24, 0.85 + Math.random() * 0.35);
  }
  /** Distant artillery rumble — the explosion sample, slowed way down. */
  playFarBoom() {
    this.play('explosion', 0.14, 0.5 + Math.random() * 0.3);
  }

  // ---- public events (sample-first, procedural fallback) ----

  playWeaponShot(bank: string) {
    if (this.play(bank, 0.9)) return;
    this.tone(120, 0.08, 0.3, 'square');
  }
  /** Weapon swap click. */
  playSwitch() {
    this.play('empty', 0.5);
  }
  playExplosion() {
    if (this.play('explosion', 1)) return;
    this.noiseBurst(0.6, 300, 0.8);
  }
  /** Kill confirmed: a crisp two-tone rise, clearly distinct from plain hits. */
  playKillConfirm() {
    const ctx = this.context;
    const master = this.output;
    if (!ctx || !master) return;
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
    this.play('wood', 0.42, 0.72);
  }
  playEnemyShot(kind: 'rifle' | 'smg' | 'sniper' = 'smg') {
    this.play('enemyShot_' + kind, 0.5);
  }
  playHit() {
    if (this.play('hit', 0.8)) return;
    this.tone(220, 0.05, 0.15, 'sawtooth');
  }
  playEnemyHit() {
    this.play('hit', 0.6);
  }
  playWoodCrack() {
    if (this.play('wood', 0.7)) return;
    this.tone(140, 0.08, 0.25, 'square');
  }
  /** Off-road rattle: a muted mechanical clunk at random pitch. */
  playRattle() {
    this.play('reload', 0.16, 0.65 + Math.random() * 0.5);
  }

  /** Pintle MG on the scout jeep — lighter crack, faster cadence. */
  playJeepMG() {
    this.play('shot_smg', 0.45, 1.02 + Math.random() * 0.22);
  }

  playReload() {
    if (this.play('reload', 0.9)) return;
    this.tone(90, 0.05, 0.2);
    setTimeout(() => this.tone(130, 0.05, 0.2), 220);
  }
  playEmpty() {
    if (this.play('empty', 0.9)) return;
    this.tone(800, 0.03, 0.12, 'square');
  }
  playDeath() {
    this.playVoice('death', 0.9); // enemy grunt (CC-BY pack)
  }
  playPlayerHurt() {
    if (this.play('bodyHit', 0.9)) return;
    this.noiseBurst(0.2, 600, 0.4);
  }
  playStep() {
    this.play('step', 0.35, 0.9 + Math.random() * 0.2);
  }

  /** Tank main gun. `near` is true when the player fired (louder). */
  playCannon(near = false) {
    this.play('cannon', near ? 1 : 0.55, 0.95 + Math.random() * 0.1);
  }

  playTankReload() {
    this.play('tankReload', 0.8, 0.9 + Math.random() * 0.2);
  }

  /** Short gear-grind while the turret traverses (cooldown-throttled by caller). */
  playTurret() {
    this.play('turret', 0.25, 1);
  }

  /** Steel-on-armour sparking clank (bullets that can't pen the hull). */
  playArmorClank() {
    if (this.play('ricochet', 0.7)) return;
    this.tone(1800, 0.04, 0.08, 'square');
  }
}
