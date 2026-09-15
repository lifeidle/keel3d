/**
 * build-create.mjs — 同步 create-keel3d 包的资源（发布前跑）。
 *
 *   node scripts/build-create.mjs
 *
 * 做两件事，保证与真相源一致、且不发散出第二份手工清单：
 *   1. templates/starter  →  packages/create-keel3d/template   （起步工程模板）
 *   2. src/catalog/catalog.json → packages/create-keel3d/recipes.json （配方清单）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, root } from './catalog-lib.mjs';

const pkgDir = path.join(root, 'packages/create-keel3d');
const templateSrc = path.join(root, 'templates/starter');
const templateOut = path.join(pkgDir, 'template');

// 1) 模板
fs.rmSync(templateOut, { recursive: true, force: true });
fs.cpSync(templateSrc, templateOut, {
  recursive: true,
  filter: (src) => !src.includes('node_modules') && !src.endsWith('.gitignore'),
});
// 模板里的 README 是给「游戏项目」看的，保持原样一起带走
fs.writeFileSync(path.join(templateOut, '.gitignore'), 'node_modules/\ndist/\n*.log\n.DS_Store\n', 'utf8');

// 2) 配方清单（只带 CLI 需要的字段）
const cat = loadCatalog();
const recipes = cat.recipes.map((r) => ({
  slug: r.slug,
  export: r.export,
  file: r.file,
  title: r.title,
  blurb: r.blurb,
}));
fs.mkdirSync(pkgDir, { recursive: true });
fs.writeFileSync(path.join(pkgDir, 'recipes.json'), JSON.stringify(recipes, null, 2) + '\n', 'utf8');

const files = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    fs.statSync(p).isDirectory() ? walk(p) : files.push(p);
  }
})(templateOut);

console.log(
  `create-keel3d 资源已同步：template ${files.length} 个文件 · recipes ${recipes.length} 条（${recipes.map((r) => r.slug).join(', ')}）`,
);
