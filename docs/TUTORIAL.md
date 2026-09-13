# Tutorial — 15 minutes to your first KeeL 3D tweak

> **KeeL 3D** · https://github.com/lifeidle/keel3d  
> 适合：会一点 TypeScript，想改出可玩网页 3D 原型。

---

## 0. 准备

```bash
npm install
npm run build && npm run preview
```

浏览器打开 `http://localhost:4173/hub.html`（端口以终端为准）。

---

## 1. 先玩：收集骨架（5 分钟）

打开 `/collect.html`。

- **WASD** 移动  
- 走近金色球自动拾取  
- 捡满后回到中央金圈  
- **R** 重开  

对应配方：`src/recipes/collect.ts`。改 `count` / `arena` 后 `npm run build` 再刷新。

---

## 2. 再玩：俯视 ARPG（5 分钟）

打开 `/arpg.html`。

- WASD 移动 · 空格/J 或底栏「攻击」  
- 击杀掉金币；右上任务「击杀 10 个目标」  
- 底栏 / 任务栏来自 `ButtonBar` / `QuestTracker` 积木  

对应：`src/recipes/arpg.ts`。

---

## 3. 自己开一包（5 分钟）

```bash
npm run new-game mycol -- --recipe collect --title "My Collect" --html
npm run build && npm run preview
# 打开 /mycol.html
```

改 `src/game/mycol/index.ts` 里的参数即可。

**规则**：只 import 你需要的积木（精确路径），不要 `export *` 整包。

---

## 4. 下一步读什么

| 文档 | 用途 |
|---|---|
| [RECIPES.md](./RECIPES.md) | 各配方字段 |
| [BLOCKS.md](./BLOCKS.md) | 积木 API 与拼装 |
| [API.md](./API.md) | GameSpec / System 契约 |
| [USER_GUIDE.md](./USER_GUIDE.md) | 完整指南 |

---

## 5. 自查清单

- [ ] `npm run typecheck` 通过  
- [ ] `npm test` 全绿  
- [ ] `npm run build`  
- [ ] `npm run probe:all`（需 preview）  
- [ ] `npm run bundle:report` 看体积  
