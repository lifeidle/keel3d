# KeeL 3D

> **品牌**：[Specul](https://specul.com) 旗下三维游戏基座 · **KeeL 3D**  
> **站点**：https://3d.specul.com · **npm**：`keel3d`  
> 二维产品线（规划）：**KeeL 2D** · `2d.specul.com` · `keel2d`

**纯浏览器 3D 游戏基座**（WebGPU + three.js + Rapier）。

不用从 `requestAnimationFrame`、刚体世界、对象池、相机机架搭起——clone 下来，只填「模型 + 玩法 + 场景」，就能做出 FPS、塔防、开放世界、飞行、赛车等不同品类的网页游戏。

| | |
|---|---|
| 渲染 | **WebGPU 唯一**（three.js r186，无 WebGL 回退） |
| 物理 | Rapier3D（标准 wasm） |
| 语言/构建 | TypeScript + Vite |
| 许可 | MIT（代码）· 素材见第三方声明 |

> 需要支持 WebGPU 的浏览器（Chrome / Edge 新版，Safari 17+）。不支持时会显示明确提示页。  
> **完整教程**：[`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) · **法律与商用**：[`docs/LEGAL.md`](docs/LEGAL.md) · **第三方版权**：[`docs/THIRD_PARTY_NOTICES.md`](docs/THIRD_PARTY_NOTICES.md)

---

## 能帮你做到什么

框架管「每个游戏都要写一遍、但和玩法无关」的部分；你只写自己游戏的内容。

| 你不用再搭 | 框架已提供 |
|---|---|
| 渲染循环 / 固定步长物理 | `Engine`（rAF + fixed-dt 累加器 + System 调度） |
| 画质档与动态分辨率 | `QualityController` |
| 键鼠 / 触摸输入 | `Input` |
| 对象池、路点、转向、寻路 | `Pool` · `Path` · `Steering` · `GridAStar` |
| 第一/第三人称/俯视相机与运行时切换 | `CameraRig.setMode` |
| 角色胶囊体 | `createUnitBody` |
| 开放世界 chunk 加载 | `ChunkWorld` |
| 三种地图模式 | `MapBuilder`：seeded / fixed / stream |
| 模型加载（Draco / KTX2） | `createGltfLoader` |
| P2P 联机协议（可选） | `src/net/`（夜袭样例已验证） |

**你负责**：`GameSpec`（声明游戏）+ 几个 `System`（玩法）+ 模型与场景。

已验证可承载的品类路径（仓库内有可运行样例或骨架）：

- **FPS**（完整样例，含联机）— `game/nightraid`
- **塔防** — `game/demo-tower`
- **修仙开放世界 / 多视角** — `game/demo-cultivation`
- **飞行 / 赛车骨架** — `game/demo-flight` · `game/demo-race`
- **空白模板** — `game/demo-template`

---

## 5 分钟跑起来

```bash
npm install
npm run build
npm run preview          # http://localhost:4173
```

或开发模式：

```bash
npm run dev              # http://localhost:5173
```

| 入口 | 内容 |
|---|---|
| **`/hub.html`** | **框架选型页：选游戏形式 → 看基底与积木 → 试玩 / 脚手架** |
| `/` 或 `index.html` | Sample A 夜袭（完整 FPS） |
| `/tower.html` | Sample B 塔防 |
| `/cultivation.html` | Sample C 修仙（1/2/3 切视角） |
| `/?game=flight` | 飞行骨架 |
| `/?game=race` | 赛车骨架 |
| `/?game=template` | 空白模板 |

塔防：`1/2/3` 选塔，点击空圆台放置。  
修仙：`1/2/3` 切第一/第三人称/俯视。

---

## 写你自己的游戏（最短路径）

```bash
npm run new-game mygame -- --title "My Game" --html
# 或塔防配方
npm run new-game mytd -- --recipe td --html
# 打开 http://localhost:4173/?game=mygame
```

编辑 `src/game/mygame/index.ts`：

```ts
export default defineGame({
  id: 'mygame',
  title: 'My Game',
  daylight: true,
  camera: { default: 'chase', allow: ['fps', 'chase', 'orbit'] },
  create: (ctx) => {
    // ctx.scene / ctx.camera — 返回 { systems, dispose }
    return { systems: [/* ... */] };
  },
});
```

脚手架会写好 `src/registry.ts` 注册与可选的 `mygame.html`。  
**不必改 `main.ts`。**

更完整的说明：

- **`docs/QUICKSTART.md`** — 分步上手  
- **`docs/API.md`** — L1/L2/L3 契约  
- **`docs/ADAPT.md`** — FPS / 塔防 / 修仙 / 飞行 / 赛车 一页纸  
- **`docs/STRUCTURE.md`** — 目录与铁律  

---

## 架构（一眼）

```
L1  src/engine/     循环 · WebGPU · 输入 · 质量 · 资产 · 音频
L2  src/blocks/     Pool Path Steering GridAStar CameraRig Unit
                    ChunkWorld MapBuilder TerrainBuilder Daylight
L3  src/content/    GameSpec · MapSpec · defineGame
──  src/game/*      内容包（互不 import）—— 你写这里
```

铁律：

1. `game/*` 之间禁止互相 import  
2. `engine/` `blocks/` `content/` 禁止 import 任何 `game/`  
3. 样例只通过框架 API 接入  

---

## 质量与验证

```bash
npm run typecheck   # 0 错误
npm test            # 26 项单测（含 blocks）
npm run build       # 生产构建

# 浏览器回归（需先 build + preview）
node scripts/game_regress.mjs http://localhost:4173/
```

设计原则：

- **前沿**：WebGPU 唯一、最新 three/Rapier、esnext  
- **不向下兼容**：老浏览器直接提示升级  
- **高配拉满、低配可降**：`QualityController` 动态分辨率 + 画质档  
- **热路径零分配**：CameraRig / Path 等 update 无每帧 GC  

---

## 部署

静态托管即可（Vite `dist/`）。联机信令若用 Cloudflare Pages：

```bash
npx wrangler pages deploy dist --project-name <your-project> --branch main
```

信令 KV 见 `wrangler.toml`。三个样例可拆成三个域名（入口 HTML 已独立）。

---

## 许可与合规

- **源代码**：**MIT**（见 `LICENSE`）— 可商用，保留版权与许可文本即可  
- **第三方依赖 / 解码器**：MIT 或 Apache-2.0  
- **`public/` 素材**：CC0 / CC-BY / CC-BY-SA（夜袭样例）— **不在 MIT 范围内**  
- 义务与免责：[`docs/LEGAL.md`](docs/LEGAL.md)  
- 完整清单与署名文本：[`docs/THIRD_PARTY_NOTICES.md`](docs/THIRD_PARTY_NOTICES.md) · [`docs/AUDIO_CREDITS.md`](docs/AUDIO_CREDITS.md)

**商用提示**：只发「框架 + 你自己的游戏」通常只需 MIT + 依赖许可；若发布含夜袭音频的完整构建，必须完成 CC-BY 署名，并处理 CC-BY-SA 语音（署名/SA 或移除该文件）。

---

## 附：夜袭（Sample A）

完整二战夜战 FPS，验证框架能承载「FPS + 程序化地图 + P2P 联机」。  
线上：https://yexi.org  

功能：任务制战役、坦克/吉普、合作 PvE / PvP 猎杀、种子化地图、中英双语。  
它只是**内容包之一**，不是框架本体。
