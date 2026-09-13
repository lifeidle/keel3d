# 框架 V3 计划 —— 像搭积木一样组游戏

> 目标：让人（以及你自己）**按需求迅速搭出各种 3D 游戏**。  
> V2 已解决「一条命令建包 + 统一启动」；V3 解决「**积木够不够多、拼起来顺不顺**」。

---

## 0. 一句话产品定义

**框架 = 地基 + 标准件仓库；游戏 = 挑标准件 + 填少量专属逻辑。**

| 你提供 | 框架提供 |
|---|---|
| 题材/模型/数值偏好 | 循环、物理、渲染、输入、地图、相机、对象池 |
| 1–N 个 System（玩法差异） | **可组合的玩法积木**（波次、经济、血条、放置、任务、昼夜…） |
| 一份 `GameSpec` | 脚手架、宿主、注册表、白天/夜晚、演示 HUD |

---

## 0.5 硬约束：按需装配，效率最高（用户定调）

> **功能要多，但默认不绑死。** 用户要哪块就装哪块；没用到的 **不进包、不进帧循环、不占内存**。

| 原则 | 落地手段 |
|---|---|
| **默认零负担** | 积木独立文件；**禁止**在 `blocks/index.ts` 做全量 `export *` 诱导入整包——按路径 `from '../../blocks/gameplay/WaveDirector'` 精确 import |
| **不自动注册** | 只有 `create()` 里 **手动** `new` 并 `systems.push` 的积木才会跑；宿主不注入任何玩法 System |
| **可 tree-shake** | 模块无顶层副作用；`package.json` 倾向 `sideEffects: false`（确认 three/rapier 排除） |
| **可选依赖** | UI 积木不进纯逻辑积木；配方文件可整份拷走改写，无强制基类 |
| **运行时可关** | ChunkWorld / 重型对象支持不创建或 `enabled=false` 即零开销 |
| **帧循环干净** | 未 push 的 System 零调用；不用的 Pool 不预分配 |
| **验收** | 新积木必带单测；样例 build 后抽查：未引用模块不应出现在产物 |

**反模式（禁止）**

- Engine / host 隐式 `new` 一堆玩法系统  
- FPS 样例 import 整包 `blocks` 把 Wave/HUD 拖进来  
- 「以后可能用」的空 System 挂在热路径  

---

## 1. 成功标准

| 标准 | 验收 |
|---|---|
| 积木可组合 | 用现成 System **不写引擎代码** 能拼出：塔防变体 / 波次生存 / 资源采集原型 |
| 15–30 分钟原型 | 从 `new-game` 到「有敌人、有血条、有胜负」可玩 |
| 配置驱动 | 单位表、塔表、波次表用 **数据**（JSON/TS 对象）描述，少写类 |
| 可复用 HUD | 血条 / 击杀播报 / 资源数 / 任务条 作为 L2 UI 积木 |
| 自己也好用 | 你做新游戏时优先 **拼积木**，只在必要时写专属 System |
| **按需付费** | 不用的积木不进 bundle / 不进帧循环（§0.5） |
| 质量不倒退 | typecheck / 26+ 测 / FPS 骨架 regress / 样例全开 |

**非目标**：完整 ECS 编辑器、资产商店、真 MMO、可视化蓝图。

---

## 2. 现状 vs 积木化差距

| 有 | 缺（积木化关键） |
|---|---|
| Pool / Path / Steering / A* / Camera / Chunk / Map | **数据驱动单位生成**（UnitTable + Spawner） |
| defineGame + registry + new-game | **可组合 System 包**（Wave / Economy / Health / Placeable） |
| 各样例自带 HUD 字符串 | **通用 HUD 积木**（DOM 或 canvas 血条） |
| 战斗写在样例里 | **通用伤害/死亡/击杀事件总线**（Emitter 已有） |
| 塔防/开放世界骨架各写各的 | **「配方」文档**：拼装步骤 + 推荐组合 |

---

## 3. 积木目录（V3 新增 L2/L3）

### 3.1 玩法积木 `src/blocks/gameplay/`（纯逻辑，少 three）

| 积木 | 职责 | 替谁省事 |
|---|---|---|
| `Health` | hp / max / damage / heal / onDeath | 所有有血单位 |
| `WaveDirector` | 按表刷怪（间隔、数量、类型） | 塔防、生存、防守 |
| `Economy` | 金币/资源 add/spend/canAfford | 塔防、建造 |
| `PlaceGrid` | 网格吸附 + 占用 + 射线选格 | 放塔、放建筑 |
| `Spawner` | 按 `UnitDef` 表从 Pool 出单位 | 通用 |
| `Timers` | 延时/周期任务（冷却、波次） | 通用 |
| `Scoreboard` | 击杀/波次/时间统计 | HUD 与胜负 |

### 3.2 展示积木 `src/blocks/ui/`

| 积木 | 职责 |
|---|---|
| `HudPanel` | 固定角标 DOM 面板（统一字体/层级） |
| `HealthBar` | 世界坐标 → 屏幕血条（sprite 或 DOM） |
| `Toast` | 短提示（击杀、获得资源） |
| `EndOverlay` | 胜/负全屏叠层（塔防已有雏形，抽出通用） |

### 3.3 配方层 `src/recipes/`（可选薄封装）

不强迫用；给「最快搭游戏」路径：

```ts
import { towerDefenseRecipe } from '../../recipes/tower-defense';

export default towerDefenseRecipe({
  id: 'my-td',
  lanes: [...],
  towers: [{ key: 'gun', cost: 50, dps: 20, range: 12 }],
  waves: [/* 或自动生成 */],
});
```

内部仍是 L2 积木 + 你的数据，**可整份拷走改**。

---

## 4. 数据驱动单位表

```ts
// src/content/units.ts — 框架侧类型；样例填表
interface UnitTable {
  [key: string]: {
    hp: number;
    speed?: number;
    radius?: number;
    color?: number;
    model?: string;
    bounty?: number;
  };
}

// 样例
const UNITS: UnitTable = {
  grunt: { hp: 40, speed: 3.5, color: 0xd94b4b, bounty: 10 },
  brute: { hp: 120, speed: 2.2, color: 0x8b2a2a, bounty: 25 },
};
```

`Spawner.spawn(key, pos)`：查表 → Pool 取 mesh → 挂 `Health` → 回调 `onDeath`（发钱、Toast）。

---

## 5. 实施阶段（可执行步骤）

### Phase W0 — 导出策略锁定（半天内，先做）

1. 审查 `blocks/index.ts`：去掉会拖大包的全量 re-export；保留类型与最常用件；文档改为「按文件路径 import」。
2. 确认 `mountSampleGame` 不注册任何玩法积木（已满足则写进注释）。
3. 抽查 `dist`：FPS 骨架包不应含 Wave/Economy 源码（若尚未存在积木则记基线体积）。

**验收**：文档与 index 策略一致；build 体积不劣化。

---

### Phase W1 — Health + Events（地基）

1. `blocks/gameplay/Health.ts`（纯数据 + 回调）
2. `Emitter` 约定事件名：`unit.died` / `unit.damaged` / `wave.start` / `economy.changed`
3. 单测：damage/death 边界

**验收**：26+ 新测绿。

---

### Phase W2 — Spawner + UnitTable + Pool 桥接

1. `UnitTable` 类型 + `Spawner`（依赖 Pool + Health + 可选 GLB/色块 mesh）
2. 塔防敌人改为 Spawner 驱动（行为不变）

**验收**：塔防仍可玩；敌人死亡有 bounty。

---

### Phase W3 — WaveDirector + Economy + Scoreboard

1. 波次表：`{ count, interval, unit: 'grunt', delay }[]`
2. 经济：add/spend/canAfford + 事件
3. 计分：kills / wave / time
4. 塔防接上（替换手写 wave 逻辑）

**验收**：塔防数值行为接近；HUD 显示金币/波次来自积木。

---

### Phase W4 — PlaceGrid

1. 世界 XZ → 格子；`occupy` / `canPlace` / `raycastPad`
2. 塔防放塔改用 PlaceGrid

**验收**：点击放塔手感不差。

---

### Phase W5 — UI 积木

1. `HudPanel` / `Toast` / `EndOverlay`（DOM）
2. `HealthBar`（屏幕投影，跟随 mesh）
3. 塔防 + 开放世界骨架 HUD 改用积木（可保留定制文案）

**验收**：两样例 HUD 正常；新样例可零 CSS 起步。

---

### Phase W6 — 配方 `towerDefenseRecipe` + 生存配方

1. `recipes/tower-defense.ts`：一张表 → 可玩 TD
2. `recipes/wave-survival.ts`：刷怪 + 血条 + 活过 N 波
3. `npm run new-game` 可选 `--recipe td|survival`

**验收**：`new-game foo --recipe td` 后改几个数字即可玩。

---

### Phase W7 — 文档「搭积木手册」

1. `docs/BLOCKS.md`：每块 API + 何时用
2. `docs/RECIPES.md`：3 个完整拼装故事（TD / 生存 / 俯视收集）
3. README 链到「15 分钟搭一个 TD」

**验收**：按文档盲拼 TD 成功。

---

## 6. 推荐组合矩阵（给「各种游戏」）

| 游戏类型 | 积木组合 |
|---|---|
| 塔防变体 | Path + Spawner + Wave + Economy + PlaceGrid + HealthBar + EndOverlay |
| 波次生存 | Spawner + Wave + Health + Steering + HealthBar + Scoreboard |
| 俯视收集 | Camera orbit + PlaceGrid/触发器 + Economy + Toast |
| 开放世界小场景 | ChunkWorld + Steering + Health + 视角切换（已有） |
| 载具圈速 | Path + Scoreboard（已有 race 骨架） |
| FPS 战役 | 复用 Sample A 模式（不强制走配方） |

---

## 7. 风险与原则

| 风险 | 原则 |
|---|---|
| 积木写死某品类 | 每个积木 **零FPS 骨架/塔防专名**；参数注入 |
| 过度抽象 | 允许复制 recipe 文件改；不强制继承 |
| 破坏FPS 骨架 | 积木先 **旁路接入** 塔防/开放世界骨架，FPS 骨架最后可选迁移 |
| 范围膨胀 | W1–W5 为必做；W6–W7 强化体验 |

---

## 8. 工作量粗估

| 阶段 | 规模 |
|---|---|
| W1 Health+Events | S |
| W2 Spawner | M |
| W3 Wave+Economy | M |
| W4 PlaceGrid | S–M |
| W5 UI 积木 | M |
| W6 Recipes | M |
| W7 文档 | S |

**合计约 3–5 天**（在 V2 基础上增量）。

---

## 9. 与 V2 关系

- V2：启动 / 注册 / 脚手架（已完成）  
- **V3：积木库 + 数据驱动 + 配方**（本计划）  
- 冲突时以本文件为准（更新目标）

---

## 10. 已定

- 框架优先、积木优先于「每个游戏手写」  
- 自己以后做游戏也走同一套积木  
- FPS 骨架不回归仍跑，但不约束积木 API  

**建议执行顺序**：W1 → W2 → W3 →（塔防接入）→ W4 → W5 → W6 → W7。
