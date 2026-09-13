/**
 * Texture pipeline: convert public/textures/*.jpg → .webp (quality 80)
 * and (optionally) downscale normal maps. Run: npm run assets:webp
 * Requires sharp (devDependency).
 */
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const texDir = path.join(root, 'public', 'textures');

async function main() {
  let files;
  try {
    files = await readdir(texDir);
  } catch {
    console.log('[webp] no textures dir');
    return;
  }
  let saved = 0;
  for (const f of files) {
    if (!f.endsWith('.jpg') && !f.endsWith('.jpeg') && !f.endsWith('.png')) continue;
    const src = path.join(texDir, f);
    const dest = path.join(texDir, f.replace(/\.(jpe?g|png)$/i, '.webp'));
    const isNor = /_nor\./i.test(f);
    try {
      await stat(dest);
      // already converted
    } catch {
      let img = sharp(src);
      const meta = await img.metadata();
      // normals: half-res is plenty for 1024 sources
      if (isNor && meta.width && meta.width > 512) {
        img = img.resize(512, 512, { fit: 'inside' });
      }
      await img.webp({ quality: isNor ? 75 : 82 }).toFile(dest);
      const a = (await stat(src)).size;
      const b = (await stat(dest)).size;
      saved += a - b;
      console.log(`[webp] ${f} ${(a / 1024).toFixed(0)}KB → ${(b / 1024).toFixed(0)}KB`);
    }
  }
  console.log(`[webp] done, saved ~${(saved / 1024 / 1024).toFixed(2)}MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
