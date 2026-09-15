/**
 * lib-check.mjs — 发布包完整性校验（P1/P2 门禁）。
 *
 *   npm run pack:lib && node scripts/lib-check.mjs
 *
 * 检查：
 *   1. package.json 的 exports 指向的文件都存在
 *   2. dist 里没有「缺扩展名的相对导入」（Node 严格 ESM / TS node16 需要）
 *   3. 两个公共入口（lib、recipes）都能解析，且 recipes 导出了全部配方工厂
 *   4. 包体积与文件数（供发布前判断）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './catalog-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'packages/keel3d');
const dist = path.join(pkgDir, 'dist');
const fail = [];

// ---------------------------------------------------------------- 1) exports
const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const exportTargets = [];
for (const [key, val] of Object.entries(pkg.exports || {})) {
  const entries = typeof val === 'string' ? [val] : Object.values(val);
  for (const rel of entries) {
    if (rel.includes('*')) continue; // 通配导出（keel3d/src/*）不逐个校验
    exportTargets.push([key, rel]);
  }
}
for (const [key, rel] of exportTargets) {
  if (!fs.existsSync(path.join(pkgDir, rel))) fail.push(`exports["${key}"] 指向的文件不存在: ${rel}`);
}

// ------------------------------------------------- 2) 相对导入必须带扩展名
const relImport = /(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g;
const hasExt = /\.(js|mjs|cjs|json|wasm|css)$/;
function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
let scanned = 0;
const missingExt = [];
/** 只扫真实代码：先挖掉块注释与行注释，避免把文档示例里的 import 当问题（曾误报 boot.ts 的示例） */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
for (const file of walk(dist)) {
  if (file.endsWith('.map') || !/\.(js|d\.ts)$/.test(file)) continue;
  scanned++;
  const src = stripComments(fs.readFileSync(file, 'utf8'));
  let m;
  while ((m = relImport.exec(src))) {
    if (!hasExt.test(m[1])) missingExt.push(`${path.relative(pkgDir, file)} → ${m[1]}`);
  }
}
if (missingExt.length) {
  fail.push(`dist 里有 ${missingExt.length} 处缺扩展名的相对导入（Node 严格 ESM 会解析失败）：`);
  for (const x of missingExt.slice(0, 10)) fail.push('    ' + x);
}

// ------------------------------------------------------- 3) 配方导出完整性
const cat = loadCatalog();
if (!fs.existsSync(path.join(dist, 'recipes/index.js'))) {
  fail.push('dist/recipes/index.js 不存在 —— tsconfig.lib.json 的 include 是否漏了 src/recipes/index.ts？');
} else {
  const barrel = fs.readFileSync(path.join(root, 'src/recipes/index.ts'), 'utf8');
  for (const r of cat.recipes) {
    if (!barrel.includes(r.export)) {
      fail.push(`src/recipes/index.ts 未导出 ${r.export}（配方 ${r.slug}）—— 包外用户 import 不到`);
    }
  }
  const dts = fs.readFileSync(path.join(dist, 'recipes/index.d.ts'), 'utf8');
  for (const r of cat.recipes) {
    if (!dts.includes(r.export)) fail.push(`dist/recipes/index.d.ts 缺类型导出 ${r.export}（配方 ${r.slug}）`);
  }
}

// ------------------------------------------------------------- 4) 体积统计
function sizeOf(dir) {
  let bytes = 0;
  let count = 0;
  for (const f of walk(dir)) {
    bytes += fs.statSync(f).size;
    count++;
  }
  return { bytes, count };
}
let summary = '（dist 不存在）';
if (fs.existsSync(dist)) {
  const s = sizeOf(dist);
  summary = `dist ${s.count} 个文件 / ${(s.bytes / 1024 / 1024).toFixed(2)} MB`;
}

if (fail.length) {
  console.error(`✘ 包完整性校验失败（${fail.length} 项）：\n`);
  for (const f of fail) console.error('  ' + f);
  console.error('');
  process.exit(1);
}
console.log(`✔ 包完整性 OK：exports 全部命中 · ${scanned} 个产物文件 specifier 规范 · ${cat.recipes.length} 个配方导出齐全`);
console.log(`  ${summary} · version ${pkg.version}`);
