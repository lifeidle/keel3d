/**
 * build-lib.mjs — Build publishable keel3d package: copy sources + emit .d.ts + JS.
 * Usage: node scripts/build-lib.mjs
 *
 * 产出 packages/keel3d/{dist,src}：
 *   dist/   编译产物（js + d.ts），供 `import ... from 'keel3d'` 与 `'keel3d/recipes'`
 *   src/    原始 TS（保留 `keel3d/src/*` 逃生通道）
 *
 * 注意：tsc **不会**重写 import specifier，产出的 `from './x'` 在 Node 严格 ESM 下
 * 无法解析（打包器能容忍）。因此这里有一道后处理补 `.js` / `/index.js`，
 * 让包在 Node、Vite、webpack、rollup 下都能解析。
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'packages', 'keel3d');
const dist = path.join(pkgDir, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// copy src tree into package (consumers resolve TS or use emitted types)
// NOTE: `ui` must be listed — the compiled graph pulls in src/ui/* (e.g.
// blocks/input/TouchControls imports ../../ui/gyro), so omitting it leaves the
// published `./src/*` export dangling even though dist/ itself still works.
const srcOut = path.join(pkgDir, 'src');
rmSync(srcOut, { recursive: true, force: true });
mkdirSync(srcOut, { recursive: true });
for (const dir of ['blocks', 'catalog', 'content', 'engine', 'physics', 'recipes', 'ui', 'world', 'config.ts', 'i18n.ts', 'lib.ts', 'registry.ts', 'main.ts']) {
  const from = path.join(root, 'src', dir);
  const to = path.join(srcOut, dir);
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

// emit declarations + JS for the public entries (lib.ts + recipes/index.ts)
const tsc = path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js');
execFileSync(process.execPath, [tsc, '-p', path.join(root, 'tsconfig.lib.json')], {
  stdio: 'inherit',
  cwd: root,
});

// ---------------------------------------------------------------------------
// 后处理：补齐相对导入的扩展名（Node 严格 ESM / TS node16 解析都需要）
// ---------------------------------------------------------------------------
const SPEC_RE = /(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g;
const HAS_EXT = /\.(js|mjs|cjs|json|wasm|css)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

let rewritten = 0;
let files = 0;
for (const file of walk(dist)) {
  if (file.endsWith('.map')) continue;
  if (!/\.(js|d\.ts)$/.test(file)) continue;
  const src = readFileSync(file, 'utf8');
  const out = src.replace(SPEC_RE, (m, pre, q, spec) => {
    if (HAS_EXT.test(spec)) return m;
    const base = path.resolve(path.dirname(file), spec);
    if (existsSync(base + '.js')) return `${pre}${q}${spec}.js${q}`;
    if (existsSync(path.join(base, 'index.js'))) return `${pre}${q}${spec}/index.js${q}`;
    return m; // 解析不到（外部依赖 / 资源），保持原样
  });
  if (out !== src) {
    writeFileSync(file, out, 'utf8');
    rewritten++;
  }
  files++;
}

// copy license + short readme
const license = path.join(root, 'LICENSE');
if (existsSync(license)) cpSync(license, path.join(pkgDir, 'LICENSE'));
writeFileSync(
  path.join(pkgDir, 'README.md'),
  `# keel3d

KeeL 3D — WebGPU browser game framework.

\`\`\`ts
import { defineGame, CharacterController, Arsenal, KitSfx } from 'keel3d';
import { arpgRecipe } from 'keel3d/recipes';
\`\`\`

Peer deps: \`three\`, \`@dimforge/rapier3d\`.

Docs: https://github.com/lifeidle/keel3d
Demo: https://keel.specul.com/3d/hub.html
`,
  'utf8',
);

const meta = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const recipes = existsSync(path.join(dist, 'recipes', 'index.js')) ? 'yes' : 'MISSING';
console.log(
  `keel3d@${meta.version} package ready → ${pkgDir}\n` +
    `  dist entries: lib.js + recipes/index.js (recipes: ${recipes})\n` +
    `  specifier fix-up: ${rewritten}/${files} files rewritten`,
);
