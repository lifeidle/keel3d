/**
 * Bundle report — list dist/assets sizes after build.
 *   node scripts/bundle-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'dist', 'assets');

if (!fs.existsSync(dir)) {
  console.error('dist/assets missing — run npm run build first');
  process.exit(1);
}

const files = fs
  .readdirSync(dir)
  .map((name) => {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    return { name, bytes: st.size };
  })
  .sort((a, b) => b.bytes - a.bytes);

let total = 0;
for (const f of files) {
  total += f.bytes;
  console.log(`${(f.bytes / 1024).toFixed(1).padStart(10)} KB  ${f.name}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(10)} KB  TOTAL (${files.length} files)`);
