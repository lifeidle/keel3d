import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ScoreDirector,
  type AudioHost,
} from '../src/blocks/audio/ScoreDirector';

/**
 * ScoreDirector (R47) — headless contract: a null-context host must make
 * every public entry point a safe no-op (no DOM/AudioContext available),
 * and dispose() must be idempotent.
 */

const nullHost: AudioHost = { context: null, output: null };

const opts = {
  moods: ['calm', 'tense', 'battle'] as const,
  moodUrl: (m: string) => `audio/music/layer_${m}.mp3`,
  menuUrl: 'audio/music/menu.mp3',
  oneShots: {
    stinger: 'audio/music/jingle_stinger.ogg',
    win: 'audio/music/jingle_win.ogg',
    defeat: 'audio/music/jingle_defeat.ogg',
  },
};

test('construction + every public entry point is a safe no-op without a context', () => {
  const d = new ScoreDirector(nullHost, opts);
  d.startRound();
  d.startMenu();
  d.stopMenu();
  d.setMood('tense');
  d.setMood('battle');
  d.playStinger();
  d.playWin();
  d.playLose();
  d.setMuted(true);
  d.setPaused(true);
  d.stop();
  assert.equal(d.moodName, null);
  assert.equal(d.menuPlaying, false);
  d.dispose();
});

test('moodName reflects nothing until a mood is applied', () => {
  const d = new ScoreDirector(nullHost, opts);
  assert.equal(d.moodName, null);
  d.startRound(); // no context → loops never start
  assert.equal(d.moodName, null);
});

test('dispose is idempotent and resets state', () => {
  const d = new ScoreDirector(nullHost, opts);
  d.setMuted(true);
  d.dispose();
  d.dispose(); // second call: no throw
  d.setMuted(false); // still usable (re-arms duck state)
  assert.equal(d.menuPlaying, false);
});

test('setMood keeps working after dispose (pending tracks the last ask)', () => {
  const d = new ScoreDirector(nullHost, opts);
  d.dispose();
  d.setMood('tense'); // no throw
  assert.equal(d.moodName, null);
});
