/**
 * Asset encode pipeline — Draco (meshes) + optional Meshopt.
 * KTX2/Basis is a later slice (needs external encoder); this script focuses
 * on GLB compression that works with pure npm packages.
 *
 *   node scripts/assets-encode.mjs                 # encode public/models/*.glb
 *   node scripts/assets-encode.mjs <in.glb> [out]  # one file
 *
 * Output: public/models-opt/<name>.glb (Draco). On failure the source is
 * copied unchanged and a warning is printed — never blocks the build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, dedup, prune } from '@gltf-transform/functions';
import draco3d from 'draco3d';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inDir = path.join(root, 'public/models');
const outDir = path.join(root, 'public/models-opt');

async function encodeOne(src, dest) {
  const io = new NodeIO()
    .registerExtensions(KHRONOS_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  const before = fs.statSync(src).size;
  const doc = await io.read(src);
  await doc.transform(dedup(), prune());
  await doc.transform(draco({ method: 'edgebreaker' }));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await io.write(dest, doc);
  const after = fs.statSync(dest).size;
  const pct = ((1 - after / before) * 100).toFixed(1);
  console.log(
    `${path.basename(src)}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB (-${pct}%)`,
  );
  return { before, after };
}

async function main() {
  const args = process.argv.slice(2);
  const jobs = [];

  if (args[0]) {
    const src = path.resolve(args[0]);
    const dest = args[1]
      ? path.resolve(args[1])
      : path.join(outDir, path.basename(src).replace(/\.glb$/i, '.glb'));
    jobs.push([src, dest]);
  } else {
    if (!fs.existsSync(inDir)) {
      console.error('no public/models/');
      process.exit(1);
    }
    for (const name of fs.readdirSync(inDir)) {
      if (!name.toLowerCase().endsWith('.glb')) continue;
      jobs.push([path.join(inDir, name), path.join(outDir, name)]);
    }
  }

  if (!jobs.length) {
    console.log('no .glb files to encode');
    return;
  }

  let fail = 0;
  for (const [src, dest] of jobs) {
    try {
      await encodeOne(src, dest);
    } catch (err) {
      fail++;
      console.warn(`encode failed for ${path.basename(src)}:`, err?.message || err);
      // fallback: copy source so loaders still find a file
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      console.warn(`  copied original as fallback → ${path.relative(root, dest)}`);
    }
  }
  console.log(fail ? `done with ${fail} fallback(s)` : 'done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
