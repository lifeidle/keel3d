/**
 * Generate self-authored kit SFX as 16-bit mono WAV (MIT / public domain dedication).
 * Usage: node scripts/gen-sfx.mjs
 * Output: public/audio/kit/*.wav
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'audio', 'kit');
mkdirSync(outDir, { recursive: true });

const SR = 22050;

function writeWav(name, samples) {
  const n = samples.length;
  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + n * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  writeFileSync(path.join(outDir, name), data);
  console.log('wrote', name, n, 'samples');
}

function env(i, n, a = 0.01, r = 0.9) {
  const t = i / n;
  if (t < a) return t / a;
  if (t > r) return Math.max(0, 1 - (t - r) / (1 - r));
  return 1;
}

function tone(freq, dur, type = 'sine', decay = 0.85) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const ph = 2 * Math.PI * freq * t;
    let s = 0;
    if (type === 'sine') s = Math.sin(ph);
    else if (type === 'square') s = Math.sign(Math.sin(ph)) * 0.4;
    else if (type === 'saw') s = (2 * ((freq * t) % 1) - 1) * 0.5;
    out[i] = s * env(i, n, 0.005, decay) * 0.7;
  }
  return out;
}

function noise(dur, decay = 0.7, lp = 0.3) {
  const n = Math.floor(SR * dur);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    prev = prev + lp * (w - prev);
    out[i] = prev * env(i, n, 0.002, decay) * 0.8;
  }
  return out;
}

function mix(...arrs) {
  const n = Math.max(...arrs.map((a) => a.length));
  const out = new Float32Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
}

// UI / feedback
writeWav('click.wav', tone(880, 0.06, 'square', 0.5));
writeWav('pickup.wav', mix(tone(660, 0.08, 'sine', 0.6), tone(990, 0.12, 'sine', 0.7)));
writeWav('hit.wav', mix(noise(0.08, 0.5, 0.5), tone(180, 0.06, 'square', 0.4)));
writeWav('shoot.wav', mix(noise(0.1, 0.55, 0.4), tone(120, 0.08, 'saw', 0.5)));
writeWav('boom.wav', mix(noise(0.35, 0.8, 0.15), tone(60, 0.3, 'sine', 0.9)));
writeWav('reload.wav', mix(tone(400, 0.05, 'square', 0.4), tone(500, 0.05, 'square', 0.5)));
writeWav('win.wav', mix(tone(523, 0.12, 'sine', 0.7), tone(659, 0.12, 'sine', 0.75), tone(784, 0.2, 'sine', 0.85)));
writeWav('lose.wav', mix(tone(220, 0.2, 'saw', 0.8), tone(180, 0.25, 'saw', 0.9)));
writeWav('place.wav', mix(tone(330, 0.07, 'square', 0.5), tone(440, 0.09, 'sine', 0.6)));

console.log('kit sfx →', outDir);
