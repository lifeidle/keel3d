/**
 * catalog-gen.mjs — 从 src/catalog/catalog.json 生成所有下游清单。
 *
 *   node scripts/catalog-gen.mjs          # 生成
 *   node scripts/catalog-gen.mjs --dry    # 只报告会改什么，不写盘
 *
 * 生成目标见 catalog-lib.mjs 的 buildTargets()：
 *   hub.html                  演示站卡片（GENRES）
 *   scripts/probe-all.mjs     浏览器探针页面表
 *   vite.config.ts            多页构建入口
 *   src/registry.ts           GAME_LOADERS + FILE_ALIASES
 *   docs/CATALOG.md           参考总表
 *
 * 新增品类只需改 catalog.json，然后跑本脚本。
 */
import fs from 'node:fs';
import path from 'node:path';
import { root, loadCatalog, eolOf, replaceRegion, validate, buildTargets } from './catalog-lib.mjs';

const dry = process.argv.includes('--dry');
const cat = loadCatalog();

// 真相源自身必须先自洽，否则不生成任何下游
const problems = validate(cat);
if (problems.length) {
  console.error('✘ catalog 校验失败（' + problems.length + ' 项），已中止生成：');
  for (const p of problems.slice(0, 25)) console.error('  - ' + p);
  process.exit(1);
}

let changed = 0;
for (const t of buildTargets(cat)) {
  const abs = path.join(root, t.file);
  const before = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
  const eol = before ? eolOf(before) : '\n';
  const after = t.full ? t.full(eol) : replaceRegion(before, { ...t, block: t.block(eol), eol });
  if (after === before) {
    console.log('  = ' + t.file + '（无变化）');
    continue;
  }
  changed++;
  if (!dry) fs.writeFileSync(abs, after, 'utf8');
  console.log('  ' + (dry ? '~' : '✎') + ' ' + t.file + ' [' + t.label + ']');
}

console.log(
  '\n' + (dry ? '（dry-run）' : '') + 'catalog v' + cat.version + ' · ' +
    cat.genres.length + ' 品类 · ' + cat.recipes.length + ' 配方 · 改动 ' + changed + ' 个文件'
);
