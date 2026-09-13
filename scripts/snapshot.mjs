/**
 * Snapshot save/restore — release-point backup beside local git.
 *
 *   node scripts/snapshot.mjs save <label>
 *   node scripts/snapshot.mjs restore <label>
 *   node scripts/snapshot.mjs list
 *
 * Copies the live project surface into _snapshots/<label>/ so any step can
 * roll back in minutes if it goes sideways.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapRoot = path.join(root, '_snapshots');

/** Paths relative to project root that define a recoverable working surface. */
const TARGETS = [
  'src',
  'test',
  'scripts',
  'public/soldier-preview.html',
  'public/tank-preview.html',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'index.html',
];

function copyInto(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      if (name === 'node_modules' || name === 'dist') continue;
      copyInto(path.join(from, name), path.join(to, name));
    }
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

function wipe(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function save(label) {
  if (!label) throw new Error('usage: save <label>');
  const dest = path.join(snapRoot, label);
  if (fs.existsSync(dest)) {
    console.error(`snapshot ${label} already exists — pick a new label or delete ${dest}`);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  let files = 0;
  for (const rel of TARGETS) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) {
      console.warn('skip missing', rel);
      continue;
    }
    copyInto(from, path.join(dest, rel));
    files++;
  }
  fs.writeFileSync(
    path.join(dest, 'META.json'),
    JSON.stringify({ label, savedAt: new Date().toISOString(), targets: TARGETS }, null, 2),
  );
  console.log(`saved snapshot "${label}" → _snapshots/${label} (${files} targets)`);
}

function restore(label) {
  if (!label) throw new Error('usage: restore <label>');
  const src = path.join(snapRoot, label);
  if (!fs.existsSync(src)) {
    console.error(`snapshot ${label} not found under _snapshots/`);
    process.exit(1);
  }
  // safety: keep the current tree before overwriting
  const auto = path.join(snapRoot, 'auto-before-restore');
  if (fs.existsSync(auto)) fs.rmSync(auto, { recursive: true, force: true });
  save('auto-before-restore');

  for (const rel of TARGETS) {
    const from = path.join(src, rel);
    const to = path.join(root, rel);
    if (!fs.existsSync(from)) continue;
    if (fs.statSync(from).isDirectory()) wipe(to);
    copyInto(from, to);
  }
  console.log(`restored snapshot "${label}" → project (backup at _snapshots/auto-before-restore)`);
}

function list() {
  if (!fs.existsSync(snapRoot)) {
    console.log('(no snapshots)');
    return;
  }
  const names = fs.readdirSync(snapRoot).filter((n) => fs.statSync(path.join(snapRoot, n)).isDirectory());
  if (!names.length) return console.log('(no snapshots)');
  for (const n of names) {
    const meta = path.join(snapRoot, n, 'META.json');
    const when = fs.existsSync(meta) ? JSON.parse(fs.readFileSync(meta, 'utf8')).savedAt : '?';
    console.log(`${n}  ${when}`);
  }
}

const [cmd, label] = process.argv.slice(2);
if (cmd === 'save') save(label);
else if (cmd === 'restore') restore(label);
else if (cmd === 'list') list();
else {
  console.error('usage: node scripts/snapshot.mjs <save|restore|list> [label]');
  process.exit(1);
}
