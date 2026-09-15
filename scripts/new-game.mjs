/**
 * new-game.mjs — 在仓库内脚手架一个内容包。
 *
 *   npm run new-game mygame
 *   npm run new-game mygame -- --title "My Game"
 *   npm run new-game mytd    -- --recipe td
 *   npm run new-game myarpg  -- --recipe arpg
 *
 * 做四件事：
 *   1. 生成 src/game/<id>/index.ts（配方包装或空白模板）
 *   2. 生成 <id>.html（可立即 /<id>.html 打开）
 *   3. 往 src/catalog/catalog.json 追加条目（showcase:false —— 注册进 registry 与
 *      构建，但不进官方演示站）
 *   4. 跑 catalog-gen，自动同步 registry / vite / probe
 *
 * 配方清单与导出名全部读自 catalog，因此**新增配方无需改动本文件**。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCatalog, root } from './catalog-lib.mjs';
import { scaffoldFor } from './scaffolds.mjs';

const USAGE = 'usage: node scripts/new-game.mjs <id> [--title "Title"] [--recipe <slug>] [--html]';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const id = process.argv[2];
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error(USAGE);
  process.exit(1);
}

const catalog = loadCatalog();
const title = arg('title', id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase()));
const recipeSlug = arg('recipe', null);

// --recipe：必须命中 catalog 里的配方
let recipe = null;
if (recipeSlug) {
  recipe = catalog.recipes.find((r) => r.slug === recipeSlug) || null;
  if (!recipe) {
    console.error(`未知配方: ${recipeSlug}\n可用配方: ${catalog.recipes.map((r) => r.slug).join(' · ')}`);
    process.exit(1);
  }
}

// 幂等保护
const srcDir = path.join(root, 'src/game', id);
if (fs.existsSync(srcDir)) {
  console.error(`已存在: src/game/${id}`);
  process.exit(1);
}
if (catalog.genres.some((g) => g.id === id)) {
  console.error(`catalog 里已有同名品类: ${id}`);
  process.exit(1);
}
if (fs.existsSync(path.join(root, `${id}.html`))) {
  console.error(`已存在: ${id}.html`);
  process.exit(1);
}

// 1) 内容包
fs.mkdirSync(srcDir, { recursive: true });
const indexFile = path.join(srcDir, 'index.ts');
if (recipe) {
  fs.writeFileSync(indexFile, scaffoldFor(recipe, id, title), 'utf8');
} else {
  const template = path.join(root, 'src/game/demo-template');
  fs.cpSync(template, srcDir, { recursive: true });
  const fnName = title.replace(/[^a-zA-Z0-9]/g, '');
  const code = fs
    .readFileSync(indexFile, 'utf8')
    .replace(/id: 'template'/g, `id: '${id}'`)
    .replace(/title: 'Template'/g, `title: '${title}'`)
    .replace(/createTemplateGame/g, `create${fnName}Game`)
    .replace(/template\.present/g, `${id}.present`)
    .replace(/TemplateDeps/g, `${fnName}Deps`)
    .replace(/game-template — empty content package skeleton\./, `Content package \`${id}\`.`);
  fs.writeFileSync(indexFile, code, 'utf8');
}

// 2) HTML 入口（始终生成，否则内容包无从访问）
fs.writeFileSync(
  path.join(root, `${id}.html`),
  `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="theme-color" content="#0a0e16" />
    <link rel="icon" href="data:," />
    <link rel="stylesheet" href="./src/styles.css" />
    <script>window.__GAME_ID__ = '${id}';</script>
  </head>
  <body>
    <div id="app"></div>
    <div id="boot">
      <div class="bootLogo">${title}</div>
      <div class="bootSub">${id.toUpperCase()}</div>
      <div class="bootBarWrap"><div id="bootFill"></div></div>
      <div id="bootTxt">Loading…</div>
    </div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
`,
  'utf8',
);

// 3) catalog 追加条目（showcase:false：可构建、可探针，但不进官方展示台）
const cmd = `npm run new-game ${id} --${recipe ? ` --recipe ${recipe.slug}` : ''} --html`;
catalog.genres.push({
  id,
  gameId: id,
  gameModule: `./game/${id}`,
  page: id,
  probe: '#boot',
  icon: '🧪',
  title,
  blurb: recipe ? `基于 ${recipe.slug} 配方的新内容包。` : '空白模板起步的新内容包。',
  tags: recipe ? [recipe.slug, 'wip'] : ['wip'],
  recipe: recipe ? recipe.slug : null,
  spec: {},
  cmd,
  createCmd: `npm create keel3d@latest ${id} --${recipe ? ` --recipe ${recipe.slug}` : ' --template blank'}`,
  note: '由 npm run new-game 自动创建（showcase:false，不出现在官方演示站）。',
  blocks: [],
  thumb: null,
  status: 'skeleton',
  showcase: false,
});
catalog.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(root, 'src/catalog/catalog.json'),
  JSON.stringify(catalog, null, 2) + '\n',
  'utf8',
);

// 4) 同步全部下游
execFileSync(process.execPath, [path.join(root, 'scripts/catalog-gen.mjs')], { stdio: 'inherit' });

console.log(`\n✓ 已创建内容包 src/game/${id}${recipe ? `（配方 ${recipe.slug}）` : '（空白模板）'}`);
console.log(`  试玩    npm run dev   →  http://localhost:5173/${id}.html`);
console.log(`  改这里  src/game/${id}/index.ts`);
console.log(`  进展示台  把 src/catalog/catalog.json 里该条目的 "showcase": false 改为 true，再跑 npm run catalog:gen`);
