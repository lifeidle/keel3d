/**
 * Build publishable keel3d package: copy sources + emit .d.ts.
 * Usage: node scripts/build-lib.mjs
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'packages', 'keel3d');
const dist = path.join(pkgDir, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// copy src tree into package (consumers resolve TS or use emitted types)
const srcOut = path.join(pkgDir, 'src');
rmSync(srcOut, { recursive: true, force: true });
mkdirSync(srcOut, { recursive: true });
for (const dir of ['blocks', 'content', 'engine', 'physics', 'recipes', 'world', 'config.ts', 'i18n.ts', 'lib.ts', 'registry.ts', 'main.ts']) {
  const from = path.join(root, 'src', dir);
  const to = path.join(srcOut, dir);
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

// emit declarations for public entry
const tsc = path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js');
execFileSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.lib.json')], {
  stdio: 'inherit',
  cwd: root,
});

// copy license + short readme
const license = path.join(root, 'LICENSE');
if (existsSync(license)) cpSync(license, path.join(pkgDir, 'LICENSE'));
writeFileSync(
  path.join(pkgDir, 'README.md'),
  `# keel3d

KeeL 3D — WebGPU browser game framework.

\`\`\`ts
import { defineGame, CharacterController, Arsenal, KitSfx } from 'keel3d';
\`\`\`

Peer deps: \`three\`, \`@dimforge/rapier3d\`.

Docs: https://github.com/lifeidle/keel3d
`,
  'utf8',
);

const meta = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
console.log(`keel3d@${meta.version} package ready → ${pkgDir}`);
