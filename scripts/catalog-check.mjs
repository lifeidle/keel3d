/**
 * catalog-check.mjs — 零漂移校验（CI 门禁）。
 *
 *   node scripts/catalog-check.mjs
 *
 * 做两件事：
 *   1. 真相源自洽：字段齐全 / 无重复 / 页面·内容包·配方文件·缩略图都存在 / 文档含该配方
 *   2. 下游未被手改：用与 catalog-gen 完全相同的目标定义重新生成，与磁盘逐字节比对
 *
 * 任何一处手改（或忘了跑 catalog:gen）都会判红。
 */
import fs from 'node:fs';
import path from 'node:path';
import { root, loadCatalog, eolOf, replaceRegion, validate, buildTargets, beginMark } from './catalog-lib.mjs';

const cat = loadCatalog();
const fail = [];

// 1) 真相源自洽
const problems = validate(cat);
if (problems.length) {
  fail.push('catalog 自身有 ' + problems.length + ' 个问题：');
  for (const p of problems) fail.push('  - ' + p);
}

// 2) 下游零漂移（与 gen 共用 buildTargets，杜绝两边参数不一致）
for (const t of buildTargets(cat)) {
  const abs = path.join(root, t.file);
  if (!fs.existsSync(abs)) {
    fail.push(t.file + ' 不存在');
    continue;
  }
  const src = fs.readFileSync(abs, 'utf8');
  const eol = eolOf(src);
  let expected;
  try {
    expected = t.full ? t.full(eol) : replaceRegion(src, { ...t, block: t.block(eol), eol });
  } catch (err) {
    fail.push(t.file + ' [' + t.label + ']: ' + err.message);
    continue;
  }
  if (expected !== src) {
    const anchor = src.indexOf(beginMark(t.label));
    fail.push(
      t.file + ' [' + t.label + '] 与 catalog 不一致' +
        (anchor === -1 ? '（缺少生成标记）' : '（标记区被手改）') +
        '\n      修复：node scripts/catalog-gen.mjs',
    );
  }
}

if (fail.length) {
  console.error('✘ catalog 零漂移校验失败（' + fail.length + ' 项）：\n');
  for (const f of fail) console.error('  ' + f);
  console.error('');
  process.exit(1);
}

console.log(
  '✔ catalog 零漂移：' + cat.genres.length + ' 品类 · ' + cat.recipes.length + ' 配方 · ' +
    'hub / probe / vite / registry / docs 全部与真相源一致',
);
