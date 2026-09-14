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
//
// Crossfade engine lives in blocks/audio/ScoreDirector; this file binds
// nightraid mood names and track URLs.

import { ScoreDirector, type AudioHost } from '../../../blocks/audio/ScoreDirector';

export type Mood = 'calm' | 'tense' | 'battle';

const MOODS: Mood[] = ['calm', 'tense', 'battle'];

export class MusicDirector extends ScoreDirector<Mood> {
  constructor(host: AudioHost) {
    super(host, {
      moods: MOODS,
      moodUrl: (m) => `audio/music/layer_${m}.mp3`,
      menuUrl: 'audio/music/menu.mp3',
      oneShots: {
        stinger: 'audio/music/jingle_stinger.ogg',
        win: 'audio/music/jingle_win.ogg',
        defeat: 'audio/music/jingle_defeat.ogg',
      },
      // Only the calm bed + stinger up front — tense/battle are multi-MB and
      // load on the first setMood() call.
      preloadMoods: ['calm'],
      preloadOneShots: ['stinger', 'win', 'defeat'],
      fadeSeconds: 1.6,
      baseVolume: 0.5,
    });
  }
}
