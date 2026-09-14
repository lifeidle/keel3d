// Bundles each TS test (resolving three + rapier) with esbuild, then runs them
// with Node's built-in test runner. Keeps the suite runnable without a browser.
//
// rapier: the app ships the standard @dimforge/rapier3d build (standalone .wasm,
// browser/WebGPU path). esbuild cannot bundle that wasm for ESM/Node output, so
// the test bundle aliases it to @dimforge/rapier3d-compat — same engine version,
// base64-embedded wasm, Node-friendly. The test files call RAPIER.init() for it.
import esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.tmp', 'test');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = ['ballistics', 'magazine', 'arsenal', 'extract-rest', 'char-tps', 'loot-inv', 'proc-dungeon', 'terrain', 'mapgen', 'combat', 'protocol', 'blocks', 'gameplay', 'interact', 'combat-blocks', 'excellence'];
const outFiles = [];
for (const f of files) {
  const outFile = path.join(out, `${f}.test.mjs`);
  await esbuild.build({
    entryPoints: [path.join(root, 'test', `${f}.test.ts`)],
    outfile: outFile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'warning',
    alias: { '@dimforge/rapier3d': '@dimforge/rapier3d-compat' },
  });
  outFiles.push(outFile);
  console.log(`bundled test/${f}.test.ts`);
}

execFileSync('node', ['--test', ...outFiles], { stdio: 'inherit' });
