import { readFileSync, writeFileSync } from 'node:fs';

// --- README ---
let r = readFileSync('README.md', 'utf8');
const start = r.indexOf('## 作为库使用（npm）');
const end = r.indexOf('## 本地开发');
if (start >= 0 && end > start) {
  const section = `## 作为库使用（npm）

\`\`\`bash
npm run pack:lib   # 生成 packages/keel3d（源码 + d.ts + 清单）
\`\`\`

\`\`\`ts
import { defineGame, CharacterController, Arsenal, KitSfx } from 'keel3d';
\`\`\`

peerDependencies：\`three\` · \`@dimforge/rapier3d\`。根仓库保持 \`private\`；在 \`packages/keel3d\` 执行 \`npm publish\`（需用户侧 2FA）。

`;
  r = r.slice(0, start) + section + r.slice(end);
  writeFileSync('README.md', r);
  console.log('README fixed');
} else {
  console.log('README markers not found', start, end);
}

// --- new-game.mjs ---
let n = readFileSync('scripts/new-game.mjs', 'utf8');
const oldVite = `} else if (vite.includes("cultivation: 'cultivation.html',")) {
    vite = vite.replace(
      "cultivation: 'cultivation.html',",
      \`cultivation: 'cultivation.html',\\n        \${id}: '\${id}.html',\`,
    );
    fs.writeFileSync(vitePath, vite);
  } else {`;
const newVite = `} else if (vite.includes("arena: 'arena.html',")) {
    vite = vite.replace(
      "arena: 'arena.html',",
      \`arena: 'arena.html',\\n        \${id}: '\${id}.html',\`,
    );
    fs.writeFileSync(vitePath, vite);
  } else if (vite.includes("'fps-arena': 'fps-arena.html',")) {
    vite = vite.replace(
      "'fps-arena': 'fps-arena.html',",
      \`'fps-arena': 'fps-arena.html',\\n        \${id}: '\${id}.html',\`,
    );
    fs.writeFileSync(vitePath, vite);
  } else {`;
if (n.includes(oldVite)) {
  n = n.replace(oldVite, newVite);
  console.log('vite patch anchors fixed');
} else {
  console.log('vite block not matched exactly — trying loose replace');
  n = n.replace(
    /vite\.includes\("cultivation: 'cultivation\.html',"\)/,
    `vite.includes("arena: 'arena.html',")`,
  );
  n = n.replace(
    /"cultivation: 'cultivation\.html',",\n      `cultivation: 'cultivation\.html',/,
    `"arena: 'arena.html',",\n      \`arena: 'arena.html',`,
  );
}
n = n.replace(
  /console\.log\(`  open  \/\?game=\$\{id\}[^`]*`\);/,
  "console.log(`  open  ${wantHtml ? `/${id}.html` : '(add HTML entry)'}`);",
);
if (n.includes('/?game=')) {
  n = n.replace(/\/\?game=\$\{id\}/g, '/${id}.html');
  console.log('removed /?game= hint');
}
writeFileSync('scripts/new-game.mjs', n);
console.log('new-game done');
