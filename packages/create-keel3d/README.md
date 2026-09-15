# create-keel3d

在空目录里起一个 [KeeL 3D](https://github.com/lifeidle/keel3d) 游戏工程（WebGPU 网页 3D 游戏基座）。

```bash
npm create keel3d@latest my-game
cd my-game
npm install
npm run dev
```

打开 <http://localhost:5173> 就是一个能玩的游戏（默认 `arpg` 配方）。

> **硬性要求**：支持 **WebGPU** 的浏览器（Chrome / Edge 新版，Safari 17+）。

## 选项

```bash
npm create keel3d@latest my-td   -- --recipe td --title "My TD"
npm create keel3d@latest my-idea -- --template blank
npm create keel3d@latest -- --help        # 列出全部配方
```

| 参数 | 说明 |
|---|---|
| `<目录名>` | 目标目录，同时作为游戏 `id`（默认 `keel3d-game`） |
| `--recipe <slug>` | 使用某个配方起步（见下） |
| `--title "标题"` | 游戏标题（默认由目录名推导） |
| `--template blank` | 空白起步：`defineGame` + 自己写 System |

## 可用配方（20）

`td` · `survival` · `arpg` · `collect` · `rally` · `dungeon` · `fps-arena` · `tps` ·
`flight-arena` · `roguelike` · `platformer` · `tycoon` · `rts-lite` · `stealth` ·
`combat-arena` · `rhythm` · `sandbox` · `br-lite` · `puzzle` · `sports`

清单由框架仓库的 `src/catalog/catalog.json` 生成（`node scripts/build-create.mjs`），
不在本包里手工维护。

## 生成出来的工程

```
my-game/
├─ index.html      画布 + 启动浮层
├─ src/game.ts     ← 你的游戏（唯一必改文件）
├─ src/main.ts     引导（建引擎 + 挂载），一般不用动
├─ vite.config.ts  已配好 base:'./' 与 target:'esnext'
└─ README.md       配方表与用法
```

## 许可

MIT。生成的工程归你。
