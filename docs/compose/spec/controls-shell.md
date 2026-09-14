---
feature: controls-shell
status: delivered
updated: 2026-09-14
branch: master
commits: (pending)
---

# Controls Shell — 包 A 体验壳：操作浮层 / 暂停菜单 / 手柄补全 / 触控下沉

## Report

四个积木与全配方接线已落地，验证：typecheck 0 错误 · **88 测全绿**（新增 `test/controls-shell.test.ts`
7 项）· build PASS · probe-boot 25/25。

交付过程中一并修掉的缺陷（原计划外）：

1. `src/ui/touch.ts` 同时 import 与 re-export `isTouchDevice`，import 那份是死引用，typecheck 被
   `noUnusedLocals` 拦住 → 去掉 import，保留 re-export（nightraid 的调用点不变）。
2. **触控摇杆前后反了**：`touchMove.z` 是「向前为正」，而 fps-arena / tps 的 `mz` 是「向前为负」，
   `mz += touchMove.z` 会让推杆前进变后退 → 改为 `mz += -touchMove.z + pad.moveY`。
3. **手柄右摇杆方向反了**：fps-arena / tps / combat-arena 都是 `yaw += pad.lookX`，而鼠标与
   ArrowRight 的约定是「向右转 = yaw 减小」→ 改为 `yaw -=`。其中 combat-arena 属既有代码，本轮一并修。
4. `ControlsOverlay` 的点击关闭没有 `stopPropagation`，点浮层会穿透到配方的 window click
   （放塔 / 建造 / 选单位）→ 已补。
5. `PauseMenu` 构造函数把所有选项写成可选却没给默认值，`new PauseMenu()` 会抛 → 改为 `opts = {}`。
6. `puzzle.ts` **从未声明 `status`**，一直在读写全局 `window.status`，导致 `status === 'playing'`
   恒为 false、胜利分支是死代码 → 补上局部声明，胜利判定恢复工作。
7. 键盘回调直接改玩法的配方（arpg 攻击 / rhythm 打拍 / stealth 噪声 / collect 重开 /
   br-lite / combat-arena 开火）在暂停时仍然生效 → 各加一道 `if (pause.paused) return;`。
8. `tycoon.ts` 漏了 `pause.system` / `controls.system` 入 systems（手柄无法暂停、浮层不会自动隐藏）→ 已补。

### 接线覆盖

- PauseMenu + ControlsOverlay：**全部 20 个有入口页的配方**（另 `survival` 为 `new-game` 脚手架，无入口页）
- Gamepad：tps · combat-arena（既有）+ fps-arena · platformer · arpg（本轮）
- TouchControls：fps-arena · tps（nightraid 走 `src/ui/touch.ts` 薄适配层，调用方零改动）

## [S1] Problem

品类覆盖（R0–R8）已走完，但「产品级体验壳」仍只有 nightraid 一个样例拥有：

1. **开局无统一操作提示** — 各配方只在 HUD 行里挤一行操作说明，玩家进游戏看不到「怎么玩」。
2. **配方无暂停** — Esc 暂停 / 暂停菜单（继续 / 重开 / 回 hub）仅 nightraid 内置；其余 21 个配方按 Esc 无反应。
3. **手柄不全** — `Gamepad` 积木已存在，但只有 tps / combat-arena 接线；fps-arena / platformer / arpg 等动作品类无 move/jump/fire 支持。
4. **触控是 nightraid 私有** — `src/ui/touch.ts` 摇杆 + 按钮 + 陀螺仪被 nightraid 独占；fps-arena / tps 手机不可玩，其它品类无任何提示。

## [S2] Design

四个可复用积木 + 全配方接线。验证继续用 `probe-boot` / `probe-all` / `npm test` / typecheck / build，不新造探针。

### Slice A — `blocks/ui/PauseMenu`

```ts
new PauseMenu({
  title: 'FPS 骨架',                 // overlay 标题
  hubUrl: 'hub.html',                // 返回 hub 目标（所有演示页与 hub.html 同目录）
  active: () => status === 'playing',// 门控：终局后 Esc 不再暂停
  onToggle: (p) => { /* 联动 touch hide/show */ },
})
pause.paused      // 配方 sim 门控：world.playing && status==='playing' && !pause.paused
pause.system      // 加入配方 systems：每帧 poll 手柄 Start 上升沿 → toggle
```

- 触发源：Esc（非锁定态 keydown）、pointer-lock 释放（浏览器吞掉锁定态 Esc，`pointerlockchange` 是可靠信号）、手柄 Start 上升沿。
- overlay：继续 / 重新开始（`location.reload`）/ 返回 hub（`location.href = hubUrl`）+ 提示行；z-index 45；**整块 stopPropagation**，防止穿透到配方的 window click 处理器（建造 / 选塔 / 选单位）。
- 不碰 `world.playing`（host autoplay 系统每帧强制 true）；暂停权威性是 `paused` 标志，由配方显式门控 sim。
- 无 DOM 环境（Node 测试）下状态机照常工作，DOM 操作全部守卫。

### Slice B — `blocks/ui/ControlsOverlay`

```ts
new ControlsOverlay({
  title: 'FPS 骨架',
  hints: [
    { keys: ['W','A','S','D'], label: '移动' },
    { keys: ['空格','J'], label: '射击' },
    { keys: ['Esc'], label: '暂停' },
  ],
  footer: '桌面设备体验更佳',  // 可选：非动作品类提示
  duration: 6,                 // 秒；0 = 不自动隐藏
})
controls.system   // 自动隐藏计时
```

开局即显示（底部居中，z-index 30，高于 HUD 低于暂停），点击任意处或超时消失。

### Slice C — 触控下沉 `blocks/input/TouchControls`

把 `src/ui/touch.ts` 的通用机制（Pointer Events 多指、全屏 look 面、浮动摇杆、自动加速、陀螺仪、按钮尺寸档）上移为可配置积木：

```ts
new TouchControls(
  {
    setMove(x, z, sprint),   // 摇杆向量 + 自动加速
    addLook(dx, dy),         // 已放大像素
    setFire(down),
  },
  [
    { id: 'fire', label: 'FIRE', kind: 'hold', onDown, onUp, size: 84 },
    { id: 'jump', label: 'JUMP', kind: 'tap', onDown, onUp, size: 56 },
  ]
)
isTouchDevice()   // coarse pointer + maxTouchPoints；触屏笔记本报 false
```

- 复用全局 `.tc-*` CSS（`src/styles.css` 已有），不新增样式文件。
- `src/ui/touch.ts` 变为薄适配层：`TouchSink` 接口不变，nightraid 调用方零改动。

### Slice D — 接线

| 配方 | PauseMenu | ControlsOverlay | Gamepad | TouchControls |
|---|---|---|---|---|
| fps-arena | ✓ | ✓ | move/look/fire | ✓（FIRE + RELOAD 按钮） |
| tps | ✓ | ✓ | move/look/fire/jump（已有） | ✓（JUMP + FIRE + RELOAD） |
| platformer | ✓ | ✓（桌面提示） | move/jump | — |
| arpg | ✓ | ✓（桌面提示） | move + A 攻击 / B 旋风斩（边沿） | — |
| 其余 17 配方 | ✓ | ✓ | — | — |

- 每个配方：sim 门控加 `!pause.paused`；`systems` 加 `pause.system, controls.system`；dispose 补齐。
- 触控设备（`isTouchDevice()`）：fps-arena / tps 跳过 pointer-lock 点击绑定（look 来自 touch 面）；暂停时 touch 隐藏、恢复时显示。

## [S3] Verification

| 检查 | 命令 | 基线 |
|---|---|---|
| typecheck | `npm run typecheck` | 0 错误 |
| 单测 | `npm test` | 81 pass（新增 controls-shell 测试后 >81） |
| build | `npm run build` | 0 错误 |
| 深度探针 | `node scripts/probe-boot.mjs` | 25/25 |
| 全页探针 | `npm run probe:all` | 无加载错误 |
