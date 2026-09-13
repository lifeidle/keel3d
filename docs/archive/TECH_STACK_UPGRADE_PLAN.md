# 夜袭 / Night Raid — 全栈技术升级计划（效率实证修订版）

> ⚠️ **历史归档（2026-09-13 标注）**：本文件的「WebGPU 探测+可回退 / compat 保留 / COOP-COEP 预留」等方案已被 `FRAMEWORK_PLAN.md` 取代
> （现行结论：WebGPU 唯一、标准 rapier3d、无 COOP/COEP）。保留仅供追溯，执行以 `FRAMEWORK_PLAN.md` + `EXECUTION_STEPS.md` 为准。

> 版本：2026-09-09 ｜ 审计：npm 实测 + **全源码热点扫描 + dist 包体解剖**
> 原则：兑现「始终用最新技术」；**以可测效率收益排序**，不为升版本而升版本。
> 每步过五关：tsc / 20 单测 / site-audit / 截图 / 帧率对账，不绿不部署。

---

## 0. 一句话结论

**引擎版本其实已经很新（three 0.186 / Rapier 0.20），真正拖效率的是三件事：**

1. **下载体积**：音频 22.3MB 占全站 37.3MB 的 **60%**，且首次手势后全量加载
2. **Draw call 爆炸**：「grand」规模 32 敌 + 24 友 = **56 兵 × ~18 子网格 ≈ 1000+ draw calls**
3. **运行时分配**：曳光/火花每发新建 Geometry + clone Material，热路径未池化

工具链（Vite 8 / TS 7）解决的是**开发速度与可维护性**，不是帧率——两边都要做，但**效率优先级必须按实测重排**。

---

## 1. 版本对账（技术债在哪）

| 技术 | 实测 | 最新 | 对效率的实际影响 |
|---|---|---|---|
| three.js | **0.186.0** | 0.186.0 | ✅ 已最新；缺的是 WebGPU/后处理**用法** |
| Rapier compat | **0.20.0** | 0.20.0 | ✅ 已最新；缺的是**多线程变体** |
| Vite | 5.4.21 | **8.2.2** | ❌ 构建/开发速度，**几乎不影响 FPS** |
| TypeScript | 5.9.3 | **7.0.2** | ❌ 检查速度，**不影响 FPS** |
| Node | v26.8.1 | — | ✅ |
| wrangler / playwright | 最新附近 | — | ✅ |

**「用最新」未兑现的是架构能力，不是版本号本身。**

---

## 2. dist 包体解剖（37.3MB，实测）

| 类别 | 体积 | 占比 | 证据 |
|---|---|---|---|
| **音频** | **22.3MB**（37 wav + 28 ogg + 4 mp3） | **60%** | `sks.wav` 2.84MB、`layer_tense.mp3` 4.37MB、`layer_battle.mp3` 3.5MB |
| 纹理 | 9.4MB（13 张 JPG，1024²） | 25% | sand/concrete/plywood/metal/rock 的 diff+nor |
| JS | ~4.0MB | 11% | rapier **2.0MB**（compat 内联 WASM base64）+ three 1.3+0.5 + app 0.24 |
| 模型 | ~1.4MB | 4% | soldier/tank/rifle GLB |

**加载路径问题（`audio.ts:244` `loadBank`）**：首次用户手势后 `Promise.all` 拉取 **全部 SFX + 中英全部语音**；`music.ts` 再拉全部 mood 层。没有「武器声即时 / 环境与语音懒加载」。

---

## 3. 运行时热点（源码实证）

### 3.1 已经做对的（不要重做）

| 手段 | 位置 | 状态 |
|---|---|---|
| 植被合并 2 draw call + GPU 风场 | `vegetation.ts` | ✅ 教科书级 |
| 沙袋 InstancedMesh | `mapgen.ts:253` | ✅ |
| 画质 3 档 + fps&lt;26 持续 6s 自动降档 | `game.ts:1453` | ✅ |
| PointLight 池（爆炸灯数量恒定，防材质重编译） | `effects.ts:29-38` | ✅ 注释写得很清楚 |
| 物理步进螺旋死亡防护 | `game.ts:41-42,2152-2170` | ✅ MAX_SUBSTEPS=5 |
| 敌人热路径 scratch 四元数/向量 | `enemy.ts:68-74` | ✅ |
| 纹理异步升级、失败可回退 | `phototex.ts` | ✅ |
| 弹壳/火焰/烟柱池化 | casings/fires/plumes | ✅ |

### 3.2 真正的效率瓶颈（按帧时间/加载时间排序）

#### 瓶颈 A — 士兵网格爆炸（grand 模式最致命）

`enemy.ts:235-309`：每个士兵独立创建 **~18 个 Mesh**（躯干/背心/双肩/头/盔/盔檐/双臂×2段/双腿×3段/激光/徽章…），且 **每人 5 个独立 `MeshStandardMaterial`**（matBody/Head/Helmet/Vest/Boot）。

```
grand: (32+24) × 18 ≈ 1000 draw calls  仅士兵
+ 地图道具、建筑、特效
→ 远超 OPTIMIZATION_PLAN 预算 draw calls < 150
```

这是 **CPU 提交 + 材质状态切换** 双重打击，也是「打大战场掉帧」的首要嫌疑。

#### 瓶颈 B — 音频全量加载（首局卡顿 / 流量）

`loadBank()` 一次解码全部；wav 未转码。首局前 22MB 在抢带宽与解码线程。

#### 瓶颈 C — 特效热路径分配

`effects.ts:53-55`：每发曳光
```ts
const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
const line = new THREE.Line(geo, this.tracerMat.clone());  // clone Material!
```
`muzzle()`/`spark()` 同样每次 `new SphereGeometry` + `new MeshBasicMaterial`。  
自动武器 8–14 发/秒 × 多名敌人 → **每秒数十次几何体/材质分配与 GPU 上传**。

#### 瓶颈 D — 静态道具未实例化

InstancedMesh **全库仅 1 处**（沙袋）。树、岩石、龙牙、残骸、建筑碎块都是独立 `THREE.Mesh`（`mapgen.ts` 大量 `addBox`/`new THREE.Mesh`）。

#### 瓶颈 E — 无动态分辨率

只有画质档位切换（阴影/像素比上限/雨量/雾距），**没有**帧率跌破阈值时的 `renderScale`（0.85×/0.7×）连续调节。波动场景仍会掉帧感。

#### 瓶颈 F — Rapier 单线程

grand 56 兵刚体 + 子弹射线全在主线程。compat 版无 SharedArrayBuffer。

#### 瓶颈 G — 每帧 DOM 与地图

`game.ts:2187-2190`：每帧 `getElementById('hud')` 并写 `style.display`；`tactical.update` 在 playing 时每帧跑。次要，但可收。

---

## 4. 效率优先级矩阵（修订后的排序）

| 优先级 | 动作 | 影响面 | 预期收益 | 风险 |
|---|---|---|---|---|
| **E0** | 音频：去 wav 双份、ogg+m4a、武器即时/环境语音懒加载 | 加载 | 22MB→**~6-7MB**，首屏 -60% | 低 |
| **E1** | **士兵合批**：共享材质 + 身体合并网格 / 远距 InstancedMesh / LOD | 帧率 | grand draw calls **1000+ → &lt;150** | 中 |
| **E2** | 特效池化：曳光/火花/枪口焰预分配，禁止 clone Material | 帧率 | 消灭热路径 GC 与材质上传 | 低 |
| **E3** | 纹理：JPG→WebP（或 AVIF），法线图降分辨率 | 加载 | 9.4MB→**~4-5MB** | 低 |
| **E4** | 静态道具 Instancing 铺开（树/岩/障碍） | 帧率 | draw calls 再降一截 | 中 |
| **E5** | 动态分辨率（帧时间驱动 renderScale） | 帧感 | 波动场景稳 60fps | 低 |
| **E6** | Rapier 多线程 + COOP/COEP | CPU | 56 实体余量；JS 从 2MB base64→独立 wasm 缓存 | 中高 |
| **E7** | 后处理 Bloom（绑档位） | 画质 | 夜战氛围；**略增 GPU**，与效率目标对冲，high 档才开 | 中 |
| **E8** | WebGPU 双后端探测 | 上限 | draw call 多、着色复杂时更优；**E1/E4 做完才值得** | 高 |
| **T1** | Vite 8 + TS 7 | 工程 | 构建/HMR/类型检查速度；**不提 FPS** | 中 |
| **T0** | lock/文档/声明对齐 | 可复现 | 消除「磁盘最新、lock 旧」风险 | 极低 |

**关键判断修正**：
- 原计划把 Vite/TS 放在最前——那是**工程效率**，不是**运行效率**。
- WebGPU 放最前也不对：若 draw call 仍 1000+，换后端只是换着慢。
- **先 E0+ E1+ E2，帧率与加载会有数量级变化；再谈 WebGPU。**

---

## 5. 分批实施（效率主线）

### S0 — 仓库卫生（0.5 天，T0）
- 重装依赖、提交一致 lock；`package.json` 声明抬到实测最新
- `three/examples/jsm` → `three/addons`（3 处）
- 回写 OPTIMIZATION_PLAN/README 真实版本
- 验收：`npm ci && typecheck && test && build`

### S1 — 音频瘦身与懒加载（1–1.5 天，E0）**最大加载收益**
1. wav 仅作构建源；dist 只保留 **ogg（Chrome/FF/Edge）+ m4a（Safari）**
2. 转码脚本进 `scripts/`；`AUDIO_CREDITS` 保留
3. `loadBank` 拆分：
   - **即时**：当前武器枪声、空仓、换弹、命中
   - **延迟**：脚步、环境鸟、载具、语音（进入战斗后 1s 或首次需要时）
   - **语音**：只解码当前语言，切语言再拉另一套
4. `music.ts`：菜单只拉 calm；battle 层在 mood 首次升高时才拉
- 验收：dist 音频 ≤8MB；冷缓存首屏（3G）目标 ≤10s；玩法听感无回归

### S2 — 士兵渲染合批（2–3 天，E1）**最大帧率收益**
分三步，可逐步上线：

1. **材质共享**：同类敌/友共享 5 个材质实例（颜色用 uniform/顶点色区分），消灭 56×5 材质
2. **网格合并**：用 `BufferGeometryUtils.mergeGeometries` 把静态躯干件合成 1 mesh（头/盔/躯干/腿可分 2–3 个可动组，而非 18 个）
3. **距离 LOD**：
   - &lt;25m：完整（可动四肢）
   - 25–60m：合并低模（2–3 mesh）
   - &gt;60m：单盒/ billboard 或 `InstancedMesh` 批渲染
4. 目标：grand 模式 `renderer.info.render.calls` **&lt; 150**（探针已有 diag，写进 e2e 断言）

- 验收：grand 1080p 60fps；截图对比方块人基因不丢

### S3 — 特效零分配池（1 天，E2）
- 曳光：预建 N 条 `Line` + 共享 Material，改 position attribute
- 火花/枪口焰：InstancedMesh 或对象池，复用 Geometry
- 禁止热路径 `material.clone()`
- 验收：连发 10 秒，diag 中 GC 尖峰消失；effects.count 受上限约束

### S4 — 纹理 WebP + 道具 Instancing（1–2 天，E3+E4）
- 13 张 JPG → WebP q80；法线图 512²
- 树/岩/龙牙/残骸改 InstancedMesh（照抄沙袋模式）
- `matrixAutoUpdate=false` 全静态物件
- 验收：纹理体积减半；draw calls 对账

### S5 — 动态分辨率（0.5–1 天，E5）
- 在现有 `updateAutoQuality` **之前**加一档：帧时间 P95 &gt; 22ms → `renderScale` 0.85→0.7
- 恢复帧率后回升；档位切换只作最后手段
- 验收：压力场景不掉档也能稳感 60

### S6 — 工具链冲顶（1–2 天，T1）
- Vite 5→6→7→8（每档验证 `netSignalingMock` 中间件 + `net_e2e`）
- TS 5.9→6→7（原生 tsgo）
- **放在 S1–S5 之后或穿插**：不阻塞效率收益，但兑现「最新技术」
- 验收：build/HMR 更快；产物路径与体积不回归

### S7 — Rapier 多线程（2 天，E6）
- `_headers` 加 COOP/COEP；换 `@dimforge/rapier3d`
- 预览域全量单机+联机回归
- 附带收益：rapier JS 从 2MB base64 → 独立 `.wasm` 长缓存

### S8 — 后处理 Bloom（1–2 天，E7）
- EffectComposer + UnrealBloomPass，仅 high/med
- low 保持直出；CSS `#fx` 作 low 回退
- **注意**：这是画质项，会吃 GPU；与 E1–E5 做完后的余量对账

### S9 — WebGPU 双后端（2–3 天，E8）
- W0：`WebGPURenderer({ forceWebGL: true })` 兼容验证
- W1：真 WebGPU + 设置页显示后端 + `?renderer=webgl` 回退
- W2：TSL 后处理与 WebGL 路径对齐
- **前置条件**：S2/S4 完成（draw call 已压下来），否则收益被 CPU 提交掩盖

---

## 6. 上线硬指标（修订）

| 指标 | 预算 | 现状（估） | 达成批次 |
|---|---|---|---|
| dist 总体积 | ≤ **12MB** | 37.3MB | S1+S4 |
| 音频 | ≤ **7MB** | 22.3MB | S1 |
| 纹理 | ≤ **5MB** | 9.4MB | S4 |
| Draw calls（grand） | **&lt; 150** | ~1000+ | S2+S4 |
| 平均帧时间 1080p | ≤16.6ms | 中档达标 / grand 压力大 | S2+S5 |
| P95 帧时间 | ≤25ms | 未测 | S5 e2e |
| 材质重编译 / 对局 | 0 | 已守（灯池） | 保持 |
| 首屏冷缓存 3G | ≤**8s** | ~25s+ | S1+S4 |

---

## 7. 明确不做 / 纠偏

| 不做 | 原因 |
|---|---|
| 先上 WebGPU 再优化 draw call | 后端换了，CPU 提交仍是瓶颈 |
| 先升 Vite/TS 当效率手段 | 只提工程速度，不提 FPS |
| 为升版本换 React 等框架 | 无 UI 框架需求，徒增包体 |
| 推翻 KV 信令 | 免费层正确决策 |
| 后处理默认全开 | 与性能目标对冲，绑档位 |
| 重写联机协议 | 二进制协议已够用 |

---

## 8. 目标态

> **下载 ≤12MB、grand 大战 draw calls &lt;150、1080p 稳 60fps、Vite 8 + TS 7 + three 0.186（WebGPU 可选）+ Rapier 0.20 多线程**，lock 可复现，文档与磁盘一致，Cloudflare Pages 免费部署不变。

---

## 9. 建议立刻执行的下一步

**从 S1（音频瘦身）或 S2（士兵合批）开工**——两者分别是加载与帧率的最大杠杆，互不阻塞，可并行。

S0 仓库卫生半天内可完成，建议夹在最前面，避免后续 lock 再漂移。
