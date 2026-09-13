/**
 * Scaffold a new content package.
 *
 *   npm run new-game mygame
 *   npm run new-game mygame --title "My Game" --html
 *
 * Copies demo-template → src/game/<id>, rewrites id/title, registers in
 * src/registry.ts, and optionally adds <id>.html + vite multi-page input.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const id = process.argv[2];
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('usage: node scripts/new-game.mjs <id> [--title "Title"] [--html]');
  process.exit(1);
}
const title = arg('title', id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase()));
const wantHtml = process.argv.includes('--html');

const srcDir = path.join(root, 'src/game', id);
if (fs.existsSync(srcDir)) {
  console.error(`already exists: src/game/${id}`);
  process.exit(1);
}

// 1) copy template
const template = path.join(root, 'src/game/demo-template');
fs.cpSync(template, srcDir, { recursive: true });

// 2) rewrite index.ts
const index = path.join(srcDir, 'index.ts');
let code = fs.readFileSync(index, 'utf8');
code = code
  .replace(/id: 'template'/g, `id: '${id}'`)
  .replace(/title: 'Template'/g, `title: '${title}'`)
  .replace(/createTemplateGame/g, `create${title.replace(/[^a-zA-Z0-9]/g, '')}Game`)
  .replace(/template\.present/g, `${id}.present`)
  .replace(/TemplateDeps/g, `${title.replace(/[^a-zA-Z0-9]/g, '')}Deps`)
  .replace(/game-template — empty content package skeleton\./, `Content package \`${id}\`.`);
fs.writeFileSync(index, code);

// 3) register in src/registry.ts
const regPath = path.join(root, 'src/registry.ts');
let reg = fs.readFileSync(regPath, 'utf8');
const entry = `  ${id}: () => import('./game/${id}'),\n  // NEW_GAME_INSERT`;
if (reg.includes('// NEW_GAME_INSERT')) {
  reg = reg.replace('  // NEW_GAME_INSERT', entry);
  fs.writeFileSync(regPath, reg);
} else {
  console.warn('WARN: NEW_GAME_INSERT marker missing in registry.ts — add the import manually');
}

// 4) optional standalone HTML
if (wantHtml) {
  const html = `<!DOCTYPE html>
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
`;
  fs.writeFileSync(path.join(root, `${id}.html`), html);

  const vitePath = path.join(root, 'vite.config.ts');
  let vite = fs.readFileSync(vitePath, 'utf8');
  if (vite.includes(`'${id}': '${id}.html'`)) {
    // already present
  } else if (vite.includes("cultivation: 'cultivation.html',")) {
    vite = vite.replace(
      "cultivation: 'cultivation.html',",
      `cultivation: 'cultivation.html',\n        ${id}: '${id}.html',`,
    );
    fs.writeFileSync(vitePath, vite);
  } else {
    console.warn('WARN: could not patch vite.config.ts input — add HTML entry manually');
  }
}

console.log(`created src/game/${id}`);
console.log(`  open  /?game=${id}${wantHtml ? `  or  /${id}.html` : ''}`);
console.log(`  edit  src/game/${id}/index.ts`);
