# 3D 游戏框架 · 进度文档（PROGRESS）

> 更新：2026-09-13（框架主轴定调） ｜ 配套：`FRAMEWORK_PLAN.md`（规划全文）· `EXECUTION_STEPS.md`（分步施工单）
> **本文件 = 唯一进度真相源**：每次工作收尾更新此文件，确保上下文丢失后可从零恢复。
> **主轴**：产品是**框架**（可适配各种三维游戏的开源基座）；三个样例互不相干，只通过框架 API 接入。

---

## 0. 一句话现状

框架化改造已开工。**Phase 0（前沿技术基线）进行中**：
- ✅ 切片 1：WebGPU 唯一化（完成）
- ✅ 切片 2：rapier3d 标准包切换（完成；tsc 0 / 测试 20/20 / build 0 警告）
- ✅ 切片 2 收尾：**浏览器回归通过**（WebGPU 后端、75 FPS、HUD 正常、**控制台 0 错误**）
- ✅ 切片 3：KTX2/Draco 资产管线（**Draco 完成**：soldier −41% / rifle −86% / tank −85%；KTX2 延后）
- ✅ 规划更新：三样例 + **框架主轴**（样例互不相干）写入 FRAMEWORK_PLAN + EXECUTION_STEPS
- ✅ **目录重组**：夜袭内容收拢 `src/game/nightraid/`；骨架 blocks/content/demo-tower/demo-cultivation；根目录清理
- ✅ **施工准备 0.0–0.2**：本地 git + 快照机制（`_snapshots/A0`）+ **回归基线**（`shots/baseline/` 全绿）
- 🔶 **Phase A 进行中**：A1 拆分 · A2 QualityAuto · A3 RenderPresent · A4 Effects · A5 Atmosphere · A6 HUD · A7 Mission ✅；A8–A12 待做（联机 tick 仍在 Game，归 A11）

---

## 1. 产品定位（已拍板 · 框架主轴）

| 角色 | 定位 | 交付义务 |
|---|---|---|
| **框架**（L1 内核 + L2 积木 + L3 契约 + 工具链 + 文档） | **产品本体**（开源游戏基座，适配各种三维游戏） | Phase 0–F 全部 |
| 夜袭（Sample A） | **独立内容包之一**（碰巧已存在的最复杂样本，用作压力测试） | 抽框架时不回归；内容增强归自己 |
| demo-tower（Sample B） | **独立内容包之一**（塔防，零其他样例代码） | 最小可玩；证 fixed+Path+orbit |
| demo-cultivation（Sample C） | **独立内容包之一**（修仙开放世界，零其他样例代码） | 最小可玩；证 stream+运行时切视角；美术另做 GLB |

**样例独立性铁律**：`src/game/<name>/` 两两禁止互相 import；框架不得反向依赖任一样例；上移 L2 必须脱敏。
将来任何新游戏 = 再加一个内容包，不碰框架、不碰其他样例。

---

## 2. 已定决策清单（全部拍板）

### 2.1 技术基线（前沿 + 不向下兼容 + 最高效率）
| 项 | 决策 | 状态 |
|---|---|---|
| 渲染 | **WebGPU 唯一**，删 WebGL2 回退与 `?renderer=webgl` 开关；无 adapter 显示明确错误页 | ✅ 已实施（切片1） |
| three 版本 | 保持最新 stable（当前 r186 = registry 最新），锁定 WebGPU 管线 | ✅ 已最新 |
| 物理 | **标准 `@dimforge/rapier3d`（独立 .wasm）**。⚠️ 重要修正：官方 JS 包**没有多线程构建**；切换标准包的真实收益 = **独立缓存 + 首屏小 26% + streaming 编译**；**不加 COOP/COEP 头** | ✅ 已完成（切片2）；0.20.0 = registry 最新 |
| 资产 | 纹理 KTX2（Basis）、模型 Draco/Meshopt、同模型实例化 | ⬜ 切片3 |
| 构建 | `build.target: esnext` | ✅ 已完成 |
| 画质 | WebGPU 后期链 + GPU 粒子，全部挂 `QualityController` 分档 | ⬜ 将来 |
| 引擎选型 | **留在 three.js，不上 Babylon.js** | ✅ 已定 |
| 维护性对齐 | `@types/three` 0.185→0.186、`vite` 8.2→8.3、`wrangler` 4.130→4.131 | ✅ 已对齐（2026-09-13；typecheck / 20 单测 / build 全绿） |

### 2.2 框架架构
- **四层结构**：L1 内核（`src/engine/`）→ L2 积木（`src/blocks/` 新建）→ L3 内容包（`src/game/<name>/`，别人填）→ L4 示例。
- **内容包 API**：`defineGame(spec)` → `GameSpec{ camera: mode | {default,allow}, player{physics: ground|air|vehicle}, units, scene, systems, config }`。
- **地图三模式（一等公民）**：`seeded`（Sample A）/ `fixed`（Sample B）/ `stream`（Sample C，**最小可工作** ChunkWorld）。
- **相机**：`CameraRig` 四模式 + **运行时 `setMode()` + lerp 过渡**（Sample C 验收）。
- **寻路三件套**：`Path` + `Steering`（标准件）+ `GridAStar`（可选，Sample C 建议启用）；`NavMesh` 仅接口位。
- **包结构**：先**单仓多目录**；npm 拆包等开源时再做。

### 2.3 迁移路线
| 阶段 | 内容 | 状态 |
|---|---|---|
| **Phase 0** | 前沿技术基线（WebGPU 唯一 + 标准 rapier3d + KTX2/Draco + esnext） | 🔶 进行中 |
| Phase A | 解耦 `core/game.ts` 大脑为真实 System | ⬜ |
| Phase B | 通用构件上移 `src/blocks/` + MapBuilder（seeded/fixed）+ CameraRig.setMode | ⬜ |
| Phase C | `defineGame` 内容包 API + 夜袭重表达 | ⬜ |
| Phase D | **demo-tower（塔防）验收样例 B** | ⬜ |
| Phase E | **demo-cultivation（修仙）验收样例 C**（ChunkWorld 最小 + 多视角） | ⬜ |
| Phase F | 开源打包（npm 三包 + template + 文档） | ⬜（另开任务） |

> 范围确认：**Phase 0→E 做到「WebGPU 下 Sample A+B+C 能跑 + 三重验证全绿」即框架完工**。

---

## 3. 已完成工作明细

### 3.1 Phase 0 切片 1 — WebGPU 唯一化 ✅（2026-09-13）

改动文件（5 个）：
| 文件 | 改动 |
|---|---|
| `src/engine/renderer.ts` | 新增 `WebGpuRequiredError` + 导出 `probeWebGPU()`；删除同步 `createEngine`（WebGL）；`createEngineAsync` 改为 WebGPU 唯一、无 adapter 直接 throw；`Engine.backend` 收窄为 `'webgpu'` |
| `src/engine/render/RendererFacade.ts` | 删 WebGL 分支与 `forceWebGL`；boot 失败即 `WebGpuRequiredError`；渲染/尺寸/阴影全走 GPU 路径 |
| `src/engine/Engine.ts` | 删 `forceWebGL` 选项与透传；删 WebGL 专属 `webglInfo` 诊断采样 |
| `src/core/game.ts` | engine 必须外部预建（否则抛 `WebGpuRequiredError`）；import 修正 |
| `src/main.ts` | WebGPU 缺失时显示明确升级提示（中英）；注释更新 |

验证：`tsc` EXIT=0；当时测试 20/20 全绿（当时 rapier 还是 compat）。

### 3.2 Phase 0 切片 2 — rapier3d 标准包切换 ✅（2026-09-13 完成）

已完成：
1. `package.json`：依赖 `@dimforge/rapier3d@^0.20.0`（生产）；`@dimforge/rapier3d-compat@^0.20.0` 移入 devDependencies（仅测试管线）
2. **14 个 src 文件** import 切换：`@dimforge/rapier3d-compat` → `@dimforge/rapier3d`
   （ai/enemy · player/player · physics/world · net/ghosts · world/{casings, destructibles, jeep, terrain, barrels, mapgen, tank, vehicles, hamlet} + main）
3. `src/main.ts`：删 `await RAPIER.init()`（标准包无需 init，wasm 在 import 时自动实例化）
4. **测试管线修复**：`scripts/test.mjs` 用 esbuild `alias` 把 `@dimforge/rapier3d` 映射到 `-compat`（同版本同引擎、base64 内嵌、Node 友好）；测试文件保持 `import compat + await RAPIER.init()` 不变
5. `vite.config.ts`：`build.target` es2020 → **esnext**（消除 wasm top-level await 警告，符合"不向下兼容"方针）
6. **浏览器构建验证 ✅**：`vite build` EXIT=0、**0 警告**
   - 产物：`rapier_wasm3d_bg-*.wasm` **2.02MB**（gzip 774KB，独立缓存）+ `rapier-*.js` **201KB**（旧 compat 为 2.72MB 单文件，省 26% 首屏 + 独立缓存）

7. **浏览器回归中发现并修复 WebGPU 隐形 bug**（见 §4.3）——`clearMap` / `Enemy.dispose` 误 dispose Sprite 共享几何体，导致每帧 50-75 个 GPU 验证错误；修复后 0 错误。

### 3.3 验收工具（本次新建，已入 `scripts/`，复用价值高）
| 文件 | 用途 |
|---|---|
| `scripts/game_regress.mjs` | 浏览器完整回归：boot→菜单→开打→HUD 断言 + 错误统计（需 `--enable-unsafe-webgpu`） |
| `scripts/buf_err_probe.mjs` | 持续监测 "Buffer used in submit while destroyed" 错误率（修复验证用） |
| `scripts/adapter_probe.mjs` | 探测 headless Chrome 拿到 WebGPU adapter 所需 flags（结论：`--enable-unsafe-webgpu` 单独用即可拿到真 GPU） |

### 3.4 规划文档
- `FRAMEWORK_PLAN.md`：完整规划（含 2.5 技术基线、3.3 地图三模式、三样例、第 8 节已定/待拍板全部关闭）
- `EXECUTION_STEPS.md`：分步施工单（Phase 0 收尾 + A12 + B9 + C4 + D4 + **E1–E5 修仙样例**）
- 2026-09-13 增补：**Sample C demo-cultivation** 写入两份文档；`stream` 从接口位升为最小可工作；`CameraRig.setMode` 升为一等 API

### 3.5 技术基线核验（2026-09-13）
| 包 | 项目内 | registry 最新 | 结论 |
|---|---|---|---|
| three | ^0.186.0 | 0.186.0 | ✅ |
| @dimforge/rapier3d | ^0.20.0 | 0.20.0 | ✅ |
| typescript | ^7.0.2 | 7.0.2 | ✅ |
| playwright | ^1.63.0 | 1.63.0 | ✅ |
| @types/three | ^0.186.0 | 0.186.0 | ✅ 已对齐 |
| vite | ^8.3.0 | 8.3.0 | ✅ 已对齐 |
| wrangler | ^4.131.1 | 4.131.1 | ✅ 已对齐 |

---

## 4. 已知问题与修复记录（历史存档）

### 4.1 测试管线 wasm 实例化（已修复 2026-09-13）
- **症状**：20 测试中 15 通过、5 失败（combat ×2、mapgen ×3），错误统一为 `wasm.rawintegrationparameters_new is not a function`
- **根因**：
  1. 标准 `rapier3d` 的 wasm 是独立 ESM 模块，**esbuild 无法为 Node 打包**（无原生 wasm loader；自写 shim 与 wasm-bindgen 接线不兼容）
  2. 测试文件 import `-compat` 与 src（标准包）混用两套 wasm 实例
- **修复（B2 方案，已落地）**：`scripts/test.mjs` 改用 esbuild `alias`：`@dimforge/rapier3d` → `@dimforge/rapier3d-compat`；compat 回归 devDependencies；测试文件不动
- **结果**：20/20 全绿 ✅

### 4.2 构建警告：top-level await（已修复 2026-09-13）
- vite 报 `TOLERATED_TRANSFORM`：wasm 实例化代码含 top-level await，target es2020 不支持
- **修复**：`vite.config.ts` `build.target` → `'esnext'` → 结果：构建 0 警告 ✅

### 4.3 ⚠️ WebGPU 共享几何体 bug（已修复 2026-09-13，重要教训）
- **症状**：对局中每帧 50-75 个 `THREE.WebGPURenderer: Uncaptured WebGPU GPUValidationError: [Buffer (unlabeled)] used in submit while destroyed`（15 秒 1237 个）；WebGL 时代**从不暴露**——因为 WebGL 缓冲由驱动管理、dispose 只是标记，而 WebGPU `destroy()` 是**立即销毁**。
- **根因**（三层证据链锁定）：
  1. `fires.group` / `plumes.group`（全是 **THREE.Sprite**：火苗、烟柱）被 add 进 `map.group`（mapgen.ts:302/537）；
  2. `clearMap` 遍历 `map.group` 无差别 dispose 一切 `geometry` —— 但 **Sprite 的 geometry 是 three.js 全 app 共享的内部单例**！它把共享 buffer 摧毁了；
  3. 此后每一帧所有仍活着的 Sprite（火、烟、枪口闪光）提交渲染时都引用已销毁 buffer → 每帧报错（错误率≈帧率）。
- **修复（2 处）**：
  - `mapgen.ts clearMap`：traverse 中 `if (isSprite) return`，跳过 Sprite 几何体（其 material 由 fires/plumes 各自 dispose 负责）；
  - `enemy.ts Enemy.dispose()`：同样跳过 Sprite（枪口闪光 sprite 挂在士兵 mesh 树上——**同款隐患**）。
- **验证**：修复后错误数 1237 → **0**；20/20 单测 + 浏览器回归全绿。
- **教训（已沉淀）**：① **永远不要 dispose Sprite 的 geometry**（three.js 全 app 共享单例）；② traverse+dispose 的代码必须显式排除 Sprite / 其他共享几何体；③ 迁移到 WebGPU 后，"旧代码里无害的 dispose 习惯"会变成致命错误——这类 bug 只有跑真 WebGPU（`--enable-unsafe-webgpu`）才能暴露。

---

## 5. 验证状态总表（截至 2026-09-13 12:10）

| 检查项 | 状态 | 命令（绝对路径，见 §7） | 备注 |
|---|---|---|---|
| typecheck | ✅ EXIT=0 | `node <tsc.js> --noEmit -p <项目>` | |
| 单元测试 | ✅ **20/20** | `node scripts/test.mjs` | alias 方案生效 |
| 生产构建 | ✅ EXIT=0、0 警告 | `node node_modules/vite/bin/vite.js build` | esnext 生效 |
| 浏览器运行 | ✅ **通过** | `scripts/game_regress.mjs` + `--enable-unsafe-webgpu` | WebGPU 后端 / 75 FPS / HUD 正常 / **0 错误** |

---

## 6. 下一步（按顺序执行，详见 `EXECUTION_STEPS.md`）

1. ~~修测试管线~~ ✅（20/20）
2. ~~build.target → esnext~~ ✅（0 警告）
3. ~~浏览器回归~~ ✅（WebGPU 可玩、0 错误；修复 sprite 共享几何体 bug）
4. ~~三样例规划增补~~ ✅（FRAMEWORK_PLAN + EXECUTION_STEPS + 本文件）
5. ~~依赖小版本对齐~~ ✅（@types/three 0.186 / vite 8.3 / wrangler 4.131；typecheck+test+build 全绿）
6. ~~深度技术审查 + 三项拍板~~ ✅（音频归夜袭内容包 / Sample C 另做修仙 GLB / Phase A 前 git init）
7. ~~框架主轴定调~~ ✅（样例互不相干；独立性铁律入 DoD）
8. ~~施工准备~~ ✅（0.0 git + 0.1 快照 `A0` + 0.2 基线 `shots/baseline/` 全绿）
9. **切片 3**：KTX2/Draco 资产管线（1.1）
10. **Phase A**：从 Sample A 抽出 L1/L2（A1–A12，脱敏后夜袭降为普通内容包）

## 6.5 审查修复记录（2026-09-13 第二轮）

- ✅ **10 个旧自测脚本修复**：裸 `chromium.launch()`（Playwright 自带浏览器本机缺失会直接崩）→ 全部改 `channel: 'chrome'`（系统 Chrome，实测无需 flag 即可跑 WebGPU）。已验证 `game_state_check` 与 `selfcheck_full` 通过。
- ✅ **预览页 favicon 404 修复**：`soldier-preview.html` / `tank-preview.html` 补 `<link rel="icon" href="data:,">`；重建后 404 消失。
- ✅ **历史文档归档标注**：`OPTIMIZATION_PLAN.md` / `TECH_STACK_UPGRADE_PLAN.md` 顶部加「已被 FRAMEWORK_PLAN.md 取代」注记（内含过时的 WebGL 回退/多线程方案，防误读）。
- ✅ **施工单落地**：`EXECUTION_STEPS.md`（Phase 0 收尾 + Phase A 12 步 + B/C/D/E/F 细分，每步含做法/验收/回滚/规模）。
- ✅ **三样例增补（2026-09-13）**：Sample C demo-cultivation 写入规划；`stream` 升最小可工作；`CameraRig.setMode` 升一等 API；开源打包改为 Phase F。
- ✅ **深度技术审查（2026-09-13）**：版本全最新；发现音频占 dist 74%（22.3MB）、WebGPU 无 render.info 诊断失明；用户拍板：①音频归夜袭内容包不进 Phase 0 ②Sample C 另做修仙 GLB ③Phase A 前 git init。
- ✅ **框架主轴定调（2026-09-13）**：产品是框架；三样例互不相干只依赖框架；写入独立性铁律（互相 import 禁止 + 脱敏上移 + DoD grep 验收）。
- ℹ️ 规划评审结论：骨架成立；已修正物理选型描述、补回滚网（快照机制）、补回归基线、拆细 Phase A。

> ⚠️ Phase 0 收尾前建议补一项：**全库排查 traverse+dispose 模式**，确认没有其他共享几何体（纹理/材质同理）被误 dispose（§4.3 同类隐患）。已排查：mapgen/enemy（已修）、fires（已正确跳过）、plumes（仅材质）、mission/barrels/tank/jeep/destructibles（无 sprite、几何体独立）

---

## 7. 环境备忘（血泪经验，防止重复踩坑）

**本机 shell 环境异常，命令全部走 PowerShell + 文件回传模式：**
- ⛔ Bash 工具：shim 缺 `dirname`/`ls`/`head` 等基础命令 → 不可用（除极简绝对路径命令）
- ⚠️ PowerShell 工具：**不回传 stdout**（只回 exit code）→ 必须 `> 文件` 或 `[System.IO.File]::WriteAllText` 后，用 Read 工具读文件
- ✅ 黄金模板（所有验证命令都这么跑）：
```powershell
$node = "C:\Users\chenhua\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
$out = & $node "<脚本绝对路径>" 2>&1; $code = $LASTEXITCODE
[System.IO.File]::WriteAllText("<输出.txt>", "EXIT=$code`n" + ($out -join "`n"), [System.Text.Encoding]::UTF8)
```

**关键绝对路径：**
| 用途 | 路径 |
|---|---|
| node | `C:\Users\chenhua\.workbuddy\binaries\node\versions\22.22.2-3\node.exe` |
| npm | 同目录 `node_modules\npm\bin\npm-cli.js`（用 node 调） |
| tsc | `<项目>\node_modules\typescript\lib\tsc.js` |
| vite build | `<项目>\node_modules\vite\bin\vite.js` |
| 测试 | `<项目>\scripts\test.mjs` |
| 诊断输出区 | `<项目>\shots\*.txt`（临时文件，可清理） |

**其他：**
- npm 脚本直接跑（`npm run`）走 shim 会坏 → 一律 node 直调脚本
- 输出文件偶尔被 Read 判为"二进制"（UTF-16/BOM）→ 用 `[System.IO.File]::WriteAllText(..., [System.Text.Encoding]::UTF8)` 强制 UTF-8 写入
- ⚠️ **PowerShell `Get-Content` + `WriteAllLines` 会毁 UTF-8 中文**（2026-09-13 实测：PROGRESS.md 被写成乱码）→ 中文文档一律用文件工具整写，或 `[System.IO.File]::ReadAllText/WriteAllText` + UTF8 编码，不要用默认的 Get-Content 管道

---

## 8. 关键文件索引

| 文件 | 说明 |
|---|---|
| `FRAMEWORK_PLAN.md` | 完整规划（战略层：分层架构、内容包 API、MapSpec 三模式、三样例、Phase 0–F） |
| `EXECUTION_STEPS.md` | 分步施工单（每步做法/验收/回滚/规模 + 行为账本 + 打勾表，含 Phase E 修仙样例） |
| `PROGRESS.md`（本文件） | 进度真相源（执行层：状态、问题、下一步、环境备忘） |
| `src/engine/` | L1 内核（Engine/renderer/RendererFacade/services/quality/assets/audio/input） |
| `src/core/game.ts` | **待解耦的"上帝类"**（Phase A 目标；2347 行，承接夜袭全部实体逻辑） |
| `src/game/nightraid/` | Sample A 内容模块（FrameSystems 薄壳 + SoldierFactory） |
| `src/game/demo-tower/` | Sample B（待建，Phase D） |
| `src/game/demo-cultivation/` | Sample C（待建，Phase E） |
| `scripts/test.mjs` | 单测管线（esbuild bundle + node --test） |
| `scripts/selfcheck_full.mjs` / `game_state_check.mjs` | 浏览器自测工具链 |
