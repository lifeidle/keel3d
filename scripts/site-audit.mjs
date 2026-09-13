// Site-wide audit: i18n completeness, asset-reference existence, copy quality.
// Run: node scripts/site-audit.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
let fails = 0;

const fail = (msg) => { fails++; console.log('FAIL', msg); };
const ok = (msg) => console.log(' ok ', msg);

// ---------- gather sources ----------
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const tsFiles = walk('src').filter((f) => f.endsWith('.ts'));
const html = readFileSync('index.html', 'utf-8');

// ---------- 1. i18n key extraction ----------
const i18nSrc = readFileSync('src/i18n.ts', 'utf-8');
const keyRe = /'([\w.]+)':\s*\{\s*zh:\s*'([^']*)',\s*en:\s*'([^']*)'/g;
const dict = new Map(); // key -> { zh, en }
let m;
while ((m = keyRe.exec(i18nSrc))) {
  if (dict.has(m[1])) fail(`i18n duplicate key: ${m[1]}`);
  dict.set(m[1], { zh: m[2], en: m[3] });
}
ok(`i18n keys parsed: ${dict.size}`);

// missing half-language entries
for (const [k, v] of dict) {
  if (!v.zh || !v.zh.trim()) fail(`i18n ${k}: empty zh`);
  if (!v.en || !v.en.trim()) fail(`i18n ${k}: empty en`);
}

// ---------- 2. t('...') references in code ----------
const used = new Set();
const tRe = /\bt\('([\w.]+)'\)/g;
for (const f of tsFiles) {
  const src = readFileSync(f, 'utf-8');
  let mm;
  while ((mm = tRe.exec(src))) used.add(mm[1]);
  // dynamic keys like t('cmd.' + next) — collect the literal prefixes
  const dynRe = /\bt\('([\w.]+)'\s*\+/g;
  while ((mm = dynRe.exec(src))) {
    const prefix = mm[1];
    for (const k of dict.keys()) if (k.startsWith(prefix)) used.add(k);
  }
}
const missing = [...used].filter((k) => !dict.has(k));
if (missing.length) fail(`code references missing i18n keys: ${missing.join(', ')}`);
else ok(`all ${used.size} t() code references resolve`);

// ---------- 3. data-i18n in HTML ----------
const dRe = /data-i18n="([\w.]+)"/g;
const htmlKeys = new Set();
let hm;
while ((hm = dRe.exec(html))) htmlKeys.add(hm[1]);
const htmlMissing = [...htmlKeys].filter((k) => !dict.has(k));
if (htmlMissing.length) fail(`data-i18n keys missing from i18n: ${htmlMissing.join(', ')}`);
else ok(`all ${htmlKeys.size} data-i18n attributes resolve`);

// ---------- 4. unused keys (informational) ----------
const unused = [...dict.keys()].filter((k) => !used.has(k) && !htmlKeys.has(k));
if (unused.length) console.log('note  unused i18n keys (informational):', unused.join(', '));

// ---------- 5. copy quality: mojibake + placeholder scan ----------
const moji = /[锛鏂娣镶纴姝ょ粺鑾峰彇鏄剧ず]/;
for (const [k, v] of dict) {
  if (moji.test(v.zh)) fail(`i18n ${k}: zh looks like mojibake -> ${v.zh}`);
  if (v.zh.includes('TODO') || v.en.includes('TODO')) fail(`i18n ${k}: placeholder TODO`);
}

// ---------- 6. asset references exist on disk ----------
const assetRe = /['"](sfx\/[\w./-]+\.(?:ogg|wav)|voice_cn\/[\w.-]+\.wav|voice_en\/[\w.-]+\.wav|music\/[\w.-]+\.(?:ogg|mp3)|textures\/[\w.-]+\.jpg)['"]/g;
const assetRefs = new Set();
for (const f of tsFiles) {
  const src = readFileSync(f, 'utf-8');
  let mm;
  while ((mm = assetRe.exec(src))) assetRefs.add(mm[1]);
}
// dynamic music paths
if (existsSync('public/audio/music')) {
  const names = readdirSync('public/audio/music');
  if (!names.includes('menu.mp3')) fail('public/audio/music/menu.mp3 missing (menu theme)');
  for (const layer of ['layer_calm.mp3', 'layer_tense.mp3', 'layer_battle.mp3']) {
    if (!names.includes(layer)) fail(`public/audio/music/${layer} missing (music director)`);
  }
  for (const j of ['jingle_stinger.ogg', 'jingle_win.ogg', 'jingle_defeat.ogg']) {
    if (!names.includes(j)) fail(`public/audio/music/${j} missing (music director)`);
  }
}
let missingAssets = 0;
for (const ref of assetRefs) {
  // BANK entries are resolved as `audio/${path}` at runtime by loadBank —
  // music/ paths already carry the audio/ prefix, sfx/voice paths do not.
  const base = ref.startsWith('music/') ? 'public' : 'public/audio';
  if (!existsSync(join(base, ref))) {
    fail(`asset referenced but missing: ${base}/${ref}`);
    missingAssets++;
  }
}
if (!missingAssets) ok(`all ${assetRefs.size} direct asset references exist`);

// ---------- 7. retina of dist sync (files built from public) ----------
const pubAudio = walk('public/audio').length;
const distAudio = walk('dist/audio').length;
// dist also carries index.html at root only; audio counts must match exactly
if (pubAudio !== distAudio) fail(`public/audio files (${pubAudio}) != dist/audio files (${distAudio}) — run npm run build`);
else ok(`dist/audio in sync (${distAudio} files)`);

console.log(fails === 0 ? '\nSITE AUDIT PASS' : `\n${fails} SITE AUDIT FAILURES`);
process.exit(fails === 0 ? 0 : 1);
