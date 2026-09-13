# KeeL 3D 使用指南

> **KeeL 3D** · Specul · https://3d.specul.com · npm `keel3d`  
> 面向「想做网页 3D 游戏、不想从零搭引擎」的人。

---

## 1. 这是什么

**KeeL 3D** 是跑在浏览器里的 **3D 游戏基座**（WebGPU + three.js + Rapier + TypeScript）。

它负责每个游戏都要写一遍、但和「具体玩什么」无关的部分：

- 渲染循环、固定步长物理  
- 输入、画质档、动态分辨率  
- 对象池、路点、转向、寻路  
- 第一/第三人称/俯视相机（可运行时切换）  
- 地图三模式（程序化 seed / 手工图 / chunk 流式）  
- 可选 P2P 联机协议  

**你负责**：题材、模型、数值，以及少量 `System`（玩法）。

### 不是什么

- 不是 Unity / Unreal：无可视化编辑器、无资产商店  
- 不是「零代码」：需要会一点 TypeScript  
- 不是真 MMO 框架：联机是 P2P 小房间  
- **必须 WebGPU**：旧浏览器会看到升级提示  

---

## 2. 你能做出什么

仓库内已有可运行路径：

| 品类 | 位置 | 你能改什么 |
|---|---|---|
| FPS（含联机） | `src/game/nightraid` | 任务、武器、地图种子 |
| 塔防 | `src/game/demo-tower` + `--recipe td` | 车道、塔表、波次、金币 |
| 修仙开放世界 | `src/game/demo-cultivation` | chunk、视角、妖兽 |
| 波次生存 | `--recipe survival` | 血量、波次、伤害 |
| 飞行 / 赛车骨架 | `demo-flight` / `demo-race` | 赛道、手感 System |

**最终成果形态**：静态网站（`dist/`），部署到任意静态托管即可玩；开发者本地 `npm run dev` 边改边看。

---

## 3. 30 分钟上手

### 3.1 环境

- Node.js ≥ 22  
- Chrome / Edge（较新版）或 Safari 17+（需 WebGPU）  

### 3.2 跑起来

```bash
npm install
npm run build
npm run preview
```

浏览器打开预览地址（默认约 `http://localhost:4173`）：

| 路径 | 内容 |
|---|---|
| `/hub.html` | **选品类 → 看基底与积木** |
| `/` | 夜袭 FPS |
| `/tower.html` | 塔防 |
| `/cultivation.html` | 修仙（1/2/3 切视角） |

### 3.3 新建自己的游戏

```bash
# 空白
npm run new-game mygame -- --title "My Game" --html

# 塔防配方（改数据即可玩）
npm run new-game mytd -- --recipe td --html

# 生存配方
npm run new-game mysurv -- --recipe survival --html
```

打开 `/?game=mygame` 或对应 html。  
编辑 `src/game/<id>/index.ts`，保存后刷新即可。

### 3.4 最小内容包长什么样

```ts
import { defineGame } from '../../content';
import { CameraRig } from '../../blocks/CameraRig';
import type { System } from '../../engine/types';

export default defineGame({
  id: 'mygame',
  title: 'My Game',
  daylight: true,
  camera: { default: 'chase', allow: ['fps', 'chase', 'orbit'] },
  create: (ctx) => {
    const rig = new CameraRig(ctx.camera, { defaultMode: 'orbit' });
    const systems: System[] = [{
      name: 'mygame.sim',
      update(ft, world) {
        rig.update(ft, ctx.scene.position, 0);
        // world.playing 为对局中
      },
    }];
    return { systems };
  },
});
```

**不要**改 `main.ts` 业务分支；新游戏只在 `src/registry.ts` 由脚手架加一行。

---

## 4. 按需拼装（效率原则）

积木在 `src/blocks/`，**用哪块 import 哪块**，不用的不进包、不进帧循环。

```ts
import { Economy } from '../../blocks/gameplay/Economy';
import { WaveDirector } from '../../blocks/gameplay/WaveDirector';
import { Health } from '../../blocks/gameplay/Health';
import { HudPanel } from '../../blocks/ui/HudPanel';
```

宿主**不会**自动注册玩法系统；只有你在 `create()` 里 `systems.push` 的才会跑。

详见 [`BLOCKS.md`](./BLOCKS.md)。

---

## 5. 文档地图

| 文档 | 用途 |
|---|---|
| [QUICKSTART.md](./QUICKSTART.md) | 步骤清单 |
| [API.md](./API.md) | 类型与契约 |
| [BLOCKS.md](./BLOCKS.md) | 积木与配方 |
| [ADAPT.md](./ADAPT.md) | 各品类一页纸 |
| [STRUCTURE.md](./STRUCTURE.md) | 目录铁律 |
| [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) | 版权与署名 |
| [LEGAL.md](./LEGAL.md) | 许可范围与免责声明 |

---

## 6. 部署

```bash
npm run build
# 将 dist/ 上传到任意静态托管（Cloudflare Pages、Nginx、对象存储…）
```

联机信令若用 Cloudflare Pages Functions，见 `functions/` 与 `wrangler.toml`。

---

## 7. 常见问题

**黑屏 / 提示需要 WebGPU？**  
换新版 Chrome/Edge，或在支持 WebGPU 的 Safari 上打开。

**改了代码没生效？**  
`npm run preview` 服务的是 `dist/`，改完先 `npm run build`。开发用 `npm run dev`。

**如何只发布自己的游戏、不要夜袭素材？**  
不要拷贝 `public/audio`、`public/models` 中夜袭专用文件；只用你自己的资产。框架代码仍是 MIT。

**可以商用吗？**  
可以。见 [LEGAL.md](./LEGAL.md)；完整夜袭构建请遵守 CC-BY 署名等条款。
