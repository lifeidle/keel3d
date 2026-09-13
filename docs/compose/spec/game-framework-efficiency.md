---
feature: game-framework-efficiency
status: delivered
updated: 2026-09-09
branch: main (no git — working tree)
commits: working-tree
---

# Game Framework Kernel + Efficiency Mainline

## Report

**What was built** — 夜袭从「单体游戏」推进为 **Engine 内核真宿主 + NightRaid sample 模块**。`main.ts` 用 `createEngineAsync`（WebGPU 探测，失败回 WebGL2，`?renderer=webgl` 强制回退）创建 live 画布，再挂 headless `Engine` 独占 rAF 与动态分辨率采样；`Game(externalLoop)` 不再自启循环。NightRaid 注册 7 个 System：StateSync / CombatSim / GameplayFrame / Effects / Atmosphere / QualityAuto / RenderPresent。效率侧延续：音频懒加载、特效池、SoldierFactory 共享材质+合并网格、士兵 >28m 四肢 LOD、岩石 InstancedMesh、纹理 WebP、QualityController 动态分辨率（单一采样源，避免双喂）。工具链顶满 Vite 8.2.2 / TypeScript 7.0.2 / three 0.186 / Rapier 0.20-compat。

**Verification**
- `npx tsc --noEmit` → PASS
- `npm test` → PASS 20/20
- `npm run build` → PASS（Vite 8.2.2）
- `npm run site-audit` → PASS

**Journey log**
1. 无 git / 无 ffmpeg：跳过 worktree；wav→ogg 未做，靠懒加载吃首屏。
2. 非 compat Rapier（独立 .wasm）被 node 测试的 esbuild 拒绝（无 wasm loader）→ 回退 compat；COOP/COEP 在 `_headers` 注释预留。
3. Review 抓出：WebGPU 只在 facade（headless 死代码）、QualityController 双喂 sampleFrame、fixedUpdate 内重复 updateAutoQuality、PowerShell 批量替换损坏 UTF-8 注释。已全部修复。
4. **WebGPU 开局镜头不进第一人称**：three r186 已废弃 `renderAsync`；`void renderAsync` 与 rAF 竞态导致画面冻在菜单机位。改为 `await init()` 后同步 `render()`；阴影类型改 `PCFShadowMap`。
5. 士兵 body 材质须 per-soldier clone（受击闪白）；特效池几何共享、材质 per-slot。树/残骸 Instancing 与 game.ts 继续拆 system 列为后续。

## [S1] Problem

夜袭可玩但：(1) game.ts 巨石，不是框架；(2) 音频/士兵 draw call/特效分配拖效率；(3) 工具链落后。目标：**最新技术 + 效率最高 + 基础游戏框架**，FPS 只是 sample。

## [S2] Design

### 2.1 Engine 内核 + Game Module（真宿主）

| 组件 | 职责 |
|---|---|
| `createEngineAsync` | live 画布：WebGPU 优先，WebGL2 回退 |
| `Engine({ headless })` | rAF、系统调度、`QualityController.sampleFrame`（唯一采样点） |
| `Game(..., { externalLoop, engine, qualityCtrl })` | 场景/AI/任务；`mount` 不启 rAF |
| NightRaid `GameModule` | 7 个 System 切片驱动 `host*` 方法 |

系统：`StateSyncSystem`、`CombatSimSystem`、`GameplayFrameSystem`、`EffectsSystem`、`AtmosphereSystem`、`QualityAutoSystem`、`RenderPresentSystem`。

### 2.2 效率主线

| ID | 状态 |
|---|---|
| E0 音频懒加载 | ✅ |
| E1 士兵合批 + 距离 LOD | ✅ |
| E2 特效池 | ✅ |
| E3 纹理 WebP | ✅ |
| E4 岩石 Instancing | ✅（树/残骸后续） |
| E5 动态分辨率（单采样） | ✅ |
| T1 Vite8 / TS7 / three0.186 / rapier0.20 | ✅ |
| W1 WebGPU 双后端（live 画布） | ✅ |
| P1 Rapier 多线程 | ○ compat 保留；隔离头预留 |

### 2.3 边界说明

- Rapier 非 compat 需 node/vite wasm 策略 + 预览域 COOP/COEP 全量回归后再切。
- TSL 后处理、game.ts 全量拆分、wav→ogg 不在本轮。

## [S3] Out of Scope

TSL 后处理、联机协议变更、部署发布、树/残骸全量 Instancing、把 remaining game.ts 拆完。

## Tasks

- [x] T1: 工具链与仓库卫生 (covers: S2 T1)
- [x] T2: Engine 内核骨架 (covers: S2.1)
- [x] T3: 音频懒加载 (covers: S2.2 E0)
- [x] T4: 特效对象池 (covers: S2.2 E2)
- [x] T5: 士兵共享材质 + 合并 (covers: S2.2 E1)
- [x] T6: 纹理 WebP (covers: S2.2 E3)
- [x] T7: 岩石 Instancing (covers: S2.2 E4)
- [x] T8: 动态分辨率 (covers: S2.2 E5)
- [x] T9: Engine 真宿主 + main 接线 (covers: S2.1)
- [x] T10: 抽出 7 个 NightRaid System (covers: S2.1)
- [x] T11: 士兵距离 LOD (covers: S2.2 E1)
- [x] T12: WebGPU 双后端 live 画布 (covers: S2.1 W1)
- [x] T13: Rapier 多线程评估与回退记录 (covers: S2.3 P1)
- [x] T14: 审查修复（双采样 / autoQuality / 编码 / 注释） (covers: S2.1)
- [x] T15: 全量验证 tsc/test/build/site-audit (covers: S2.3)
