# KeeL 3D 起步工程

用 [KeeL 3D](https://github.com/lifeidle/keel3d)（WebGPU 网页 3D 游戏基座）搭一个自己的游戏。
演示站：<https://keel.specul.com/3d/hub.html>

## 快速开始

```bash
npm install
npm run dev        # → http://localhost:5173
```

打开后就是一个能玩的游戏（默认 `arpg` 配方）。

> **硬性要求**：支持 **WebGPU** 的浏览器（Chrome / Edge 新版，Safari 17+）。
> 打开 `chrome://gpu` 可确认 WebGPU 是否可用。

## 改你自己的游戏

只有一个文件需要动：**`src/game.ts`**

```ts
import { arpgRecipe } from 'keel3d/recipes';

export default arpgRecipe({
  id: 'my-game',
  title: 'My Game',
});
```

1. **换玩法** —— 把 `arpgRecipe` 换成别的配方（见下表），或给配方传参数调数值。
2. **加逻辑** —— 需要更自由时，用 `defineGame` + 框架积木自己写 `System`：

```ts
import { defineGame, type System } from 'keel3d';

const mySystem: System = {
  name: 'my-game.sim',
  fixedUpdate(dt, world) {
    if (!world.playing) return;
    // 每帧逻辑（60Hz 固定步长）
  },
};

export default defineGame({
  id: 'my-game',
  title: 'My Game',
  camera: 'chase',
  create: () => ({ systems: [mySystem] }),
});
```

## 可用配方（20 个）

| 配方 | 玩法 |
|---|---|
| `td` | 塔防：固定路线放塔、波次经济 |
| `survival` | 波次生存：撑过一波波敌人 |
| `arpg` | 俯视 ARPG：近战/弹道/掉落 |
| `collect` | 收集：捡满目标回圈交付 |
| `rally` | 拉力赛：按序穿检查点比圈速 |
| `dungeon` | 地牢：多房间门锁 + Boss |
| `fps-arena` | 第一人称靶场 |
| `tps` | 第三人称：肩扛视角 + 手柄 |
| `flight-arena` | 空战：缠斗与敌机波次 |
| `roguelike` | 程序化地牢 + 战利品背包 |
| `platformer` | 平台跳跃登顶 |
| `tycoon` | 城建经营 |
| `rts-lite` | 选中下令、两军交战 |
| `stealth` | 躲开视锥守卫 |
| `combat-arena` | 载具对战 |
| `rhythm` | 音游节拍判定 |
| `sandbox` | 体素沙盒 |
| `br-lite` | 毒圈收缩生存 |
| `puzzle` | 物理推箱 |
| `sports` | 带球入门与计分 |

```ts
import { towerDefenseRecipe } from 'keel3d/recipes';
export default towerDefenseRecipe({ id: 'my-td', title: 'My TD' });
```

每个配方的完整参数、操作与胜负条件见
[文档 RECIPES.md](https://github.com/lifeidle/keel3d/blob/master/docs/RECIPES.md)。

## 构建发布

```bash
npm run build      # → dist/，纯静态，丢到任意静态托管
npm run preview    # 本地预览构建产物
```

## 本地开发框架本身

想改框架源码（而不是只用它）时，把依赖指向本地仓库：

```bash
npm install file:../keel3d/packages/keel3d
# 改完框架后重新打包并刷新依赖：
cd ../keel3d && npm run pack:lib
```

## 目录

```
src/game.ts     ← 你的游戏（唯一必改文件）
src/main.ts     引导（建引擎 + 挂载），一般不用动
index.html      画布与启动浮层
```

## 许可

框架 MIT。你的游戏代码归你。
