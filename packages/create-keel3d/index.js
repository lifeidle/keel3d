#!/usr/bin/env node
/**
 * create-keel3d — 在空目录里起一个 KeeL 3D 游戏工程。
 *
 *   npm create keel3d@latest my-game
 *   npm create keel3d@latest my-game -- --recipe roguelike
 *   npm create keel3d@latest my-game -- --recipe td --title "My TD"
 *   npm create keel3d@latest my-game -- --template blank
 *
 * 不依赖 keel3d 仓库：模板与配方清单随本包一起发布。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.join(here, 'template');
const recipes = JSON.parse(fs.readFileSync(path.join(here, 'recipes.json'), 'utf8'));

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name) => argv.includes(`--${name}`);

if (has('help') || has('h')) {
  usage(0);
}

const positional = argv.filter((a) => !a.startsWith('--'));
const targetName = positional[0] || 'keel3d-game';
const targetDir = path.resolve(process.cwd(), targetName);
const recipeSlug = flag('recipe');
const isBlank = has('template') && flag('template') === 'blank';

let recipe = null;
if (recipeSlug) {
  recipe = recipes.find((r) => r.slug === recipeSlug);
  if (!recipe) {
    console.error(`✘ 未知配方: ${recipeSlug}\n`);
    usage(1);
  }
}

const id = path
  .basename(targetDir)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'my-game';
const title = flag('title') || id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

// 目标目录检查
if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
  console.error(`✘ 目录非空: ${targetDir}`);
  process.exit(1);
}

// 1) 拷模板
fs.mkdirSync(targetDir, { recursive: true });
fs.cpSync(templateDir, targetDir, { recursive: true });

// 2) package.json 名字
const pkgPath = path.join(targetDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = id;
if (recipe) pkg.description = `${title} — a ${recipe.slug} game built on KeeL 3D.`;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// 3) src/game.ts：配方包装 或 空白 defineGame
const gamePath = path.join(targetDir, 'src/game.ts');
fs.writeFileSync(gamePath, isBlank || !recipe ? blankGame(id, title) : recipeGame(recipe, id, title), 'utf8');

// 4) index.html 标题
const htmlPath = path.join(targetDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html
  .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  .replace(/(<div class="bootLogo">)[^<]*(<\/div>)/, `$1${title}$2`)
  .replace(/(<div class="bootSub">)[^<]*(<\/div>)/, `$1${id}$2`);
fs.writeFileSync(htmlPath, html, 'utf8');

// 5) README 顶部换成项目名
const readmePath = path.join(targetDir, 'README.md');
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, 'utf8').replace(/^# .*/m, `# ${title}`);
  fs.writeFileSync(readmePath, readme, 'utf8');
}

console.log(`
✓ 已创建 ${title}  →  ${targetDir}
  配方    ${recipe ? recipe.slug + '（' + recipe.blurb + '）' : '空白模板（defineGame 自己写）'}

  下一步：
    cd ${path.relative(process.cwd(), targetDir) || '.'}
    npm install
    npm run dev
`);

function recipeGame(r, gid, gtitle) {
  return `/**
 * \`${gid}\` — 基于 \`${r.slug}\` 配方（${r.blurb}）。
 * 参数与玩法见 https://github.com/lifeidle/keel3d/blob/master/docs/RECIPES.md
 * 换配方：改成 \`keel3d/recipes\` 里的任意一个导出即可。
 */
import { ${r.export} } from 'keel3d/recipes';

export default ${r.export}({
  id: '${gid}',
  title: '${gtitle}',
});
`;
}

function blankGame(gid, gtitle) {
  return `/**
 * \`${gid}\` — 空白起步：自己写 System。
 * 积木清单见 https://github.com/lifeidle/keel3d/blob/master/docs/BLOCKS.md
 */
import { defineGame, type System } from 'keel3d';

const sim: System = {
  name: '${gid}.sim',
  fixedUpdate(dt, world) {
    if (!world.playing) return;
    // 每帧逻辑（60Hz 固定步长；物理/AI 建议放这里）
  },
};

export default defineGame({
  id: '${gid}',
  title: '${gtitle}',
  camera: 'orbit',
  create: () => ({ systems: [sim] }),
});
`;
}

function usage(code) {
  console.log(`create-keel3d — 起一个 KeeL 3D 游戏工程（WebGPU 网页 3D 游戏基座）

用法：
  npm create keel3d@latest <目录名> [-- --recipe <配方>] [--title "标题"] [--template blank]

示例：
  npm create keel3d@latest my-game
  npm create keel3d@latest my-rogu -- --recipe roguelike
  npm create keel3d@latest my-td   -- --recipe td --title "My TD"
  npm create keel3d@latest my-idea -- --template blank

可用配方（${recipes.length} 个）：
${recipes.map((r) => `  ${r.slug.padEnd(14)} ${r.blurb}`).join('\n')}
`);
  process.exit(code);
}
