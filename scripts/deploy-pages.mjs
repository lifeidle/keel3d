/**
 * Classic GitHub Pages deploy: build → push dist/ to gh-pages.
 *   npm run deploy:pages
 * Settings → Pages → Deploy from a branch → gh-pages / (root)
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

console.log('build…');
run('npm', ['run', 'build'], root);
if (!existsSync(path.join(dist, 'hub.html'))) {
  console.error('dist/hub.html missing after build');
  process.exit(1);
}

const work = mkdtempSync(path.join(tmpdir(), 'keel3d-pages-'));
try {
  // Fresh orphan tree with only dist contents
  run('git', ['init'], work);
  run('git', ['checkout', '-b', 'gh-pages'], work);
  cpSync(dist, work, { recursive: true });
  writeFileSync(path.join(work, '.nojekyll'), '');
  if (!existsSync(path.join(work, 'CNAME')) && existsSync(path.join(root, 'public', 'CNAME'))) {
    cpSync(path.join(root, 'public', 'CNAME'), path.join(work, 'CNAME'));
  }
  run('git', ['add', '-A'], work);
  run(
    'git',
    [
      '-c',
      'user.name=lifeidle',
      '-c',
      'user.email=lifeidle@users.noreply.github.com',
      'commit',
      '-m',
      'deploy: site',
    ],
    work,
  );
  // First push may need -u; force is OK for an orphan deploy branch
  try {
    run('git', ['push', '-f', process.cwd() ? 'origin' : 'origin', 'HEAD:gh-pages'], work);
  } catch {
    // resolve origin from parent repo remote URL
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim();
    run('git', ['push', '-f', url, 'HEAD:gh-pages'], work);
  }
  console.log('pushed gh-pages');
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log('Next: Settings → Pages → Deploy from a branch → gh-pages / root → domain keel.specul.com');
