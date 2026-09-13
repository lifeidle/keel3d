/**
 * unused-check — list blocks modules never imported by recipes or demos.
 * Informational only (exit 0).
 *   node scripts/unused-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.ts') && e.name !== 'index.ts') acc.push(p);
  }
  return acc;
}

const blocks = walk(path.join(root, 'src/blocks'));
const consumers = [
  ...walk(path.join(root, 'src/recipes')),
  ...walk(path.join(root, 'src/game')),
  ...walk(path.join(root, 'src/content')),
];

let all = '';
for (const f of consumers) all += fs.readFileSync(f, 'utf8') + '\n';

const unused = [];
for (const b of blocks) {
  const base = path.basename(b, '.ts');
  if (!all.includes(base)) unused.push(path.relative(root, b));
}

console.log(`blocks modules: ${blocks.length}`);
if (unused.length === 0) console.log('unused-check: all block modules referenced by recipes/demos');
else {
  console.log('unused-check: possibly unused (informational):');
  for (const u of unused) console.log('  -', u);
}
