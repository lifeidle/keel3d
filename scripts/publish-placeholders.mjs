/**
 * Publish KeeL name-reservation packages (keel3d, keel2d).
 * Requires: npm login (npm whoami must succeed).
 *
 *   node scripts/publish-placeholders.mjs
 *   node scripts/publish-placeholders.mjs --dry-run
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry-run');

const packs = [
  path.join(root, 'packages/placeholder-keel3d'),
  path.join(root, 'packages/placeholder-keel2d'),
];

function whoami() {
  try {
    return execFileSync('npm', ['whoami'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const user = whoami();
if (!user) {
  console.error('Not logged in. Run:  npm login');
  process.exit(1);
}
console.log(`npm user: ${user}`);

for (const dir of packs) {
  const name = path.basename(dir);
  console.log(`\n=== ${name} ===`);
  const args = ['publish', '--access', 'public'];
  if (dry) args.push('--dry-run');
  try {
    execFileSync('npm', args, { cwd: dir, stdio: 'inherit' });
    console.log(dry ? `dry-run ok: ${name}` : `published: ${name}`);
  } catch (e) {
    console.error(`publish failed for ${name}`);
    console.error(String(e.message || e));
    process.exitCode = 1;
  }
}

console.log('\nDone. Verify: npm view keel3d version && npm view keel2d version');
