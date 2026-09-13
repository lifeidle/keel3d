# 多人联机技术方案（阶段 1：P2P 合作 PvE）

状态：**✅ 已全部完成并上线**（M1-M4 于 2026-09-06 实施，随 yexi.org 部署） ｜ 更新：2026-09-06 ｜ 决策人：项目所有者

## 0. 定案摘要

| 项 | 决策 |
|---|---|
| 模式 | 合作 PvE + 休闲 PvP 猎杀（FFA，先到 15 杀或 10 分钟）｜2-8 人（架构按 8 全开） |
| 拓扑 | **Host 权威 P2P**（WebRTC DataChannel）——主机跑全部模拟 |
| 信令 | **Cloudflare Pages Functions + Workers KV 轮询**（无 DO、无 WebSocket、无状态） |
| NAT 穿透 | 仅免费 STUN（stun.l.google.com:19302 / stun.cloudflare.com:3478）——**不开 TURN，不绑卡** |
| 部署 | 与游戏同仓：游戏 = Cloudflare Pages，信令 = Pages Functions（免费层 10 万请求/天） |
| 穿透失败 | 明确提示"当前网络无法直连"（阶段 2 再考虑中继） |
| 阶段 1 联机限制 | 步兵 + 吉普载具可用；敌方 AI 坦克为 host 专属（client 收广播状态）。PvP 模式无 AI 敌人 |

## 1. 为什么这套组合（关键决策记录）

- **P2P 而非中继**：游戏流量不经过任何服务器 → 免费计划零压力、同城延迟 <10ms
- **KV 轮询而非 Durable Object WebSocket**：信令握手是低频操作（每房 ~6 写 + ~30 读），KV 免费额度（100k 读/天）大量富余；无长连接 = 无状态 = 免费层最稳
- **不开 TURN**：需要绑卡。STUN 已覆盖绝大多数家用网络；失败的少数场景给出明确提示
- **不用 PeerJS/simple-peer**：已过时/停维护，抽象泄漏——原生 RTCPeerConnection 薄封装约 300 行，可控

## 2. 信令协议（Pages Functions + KV）

KV 键（TTL 300s，握手完成后主动删除）：

```
nr:room:{CODE}:offer    JSON { sdp, ice[], createdAt }     主机写入
nr:room:{CODE}:answer   JSON { sdp, ice[], createdAt }     加入者写入
```

Pages Functions 端点（`functions/api/net/[[path]].ts`）：

| 方法 | 路径 | 行为 |
|---|---|---|
| POST | `/api/net/room` | 创建：body={code, offer} → KV put，返回 {ok} |
| GET | `/api/net/room/{code}/offer` | 加入者拉取主机 offer |
| POST | `/api/net/room/{code}/answer` | 加入者写入 answer |
| GET | `/api/net/room/{code}/answer` | 主机轮询 answer（1s 间隔，最多 60s） |
| DELETE | `/api/net/room/{code}` | 任一方清理 |

房间码：4 位大写字母数字（去易混字符），冲突重试。轮询节奏：1s 间隔（握手阶段延迟 1-3s 可接受）。

## 3. WebRTC 配置

- `RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] })`
- 双 DataChannel：
  - **`game-rel`**（reliable, ordered）：事件类——开火/命中申报/击杀/拾取/任务/聊天
  - **`game-unrel`**（unreliable, unordered, maxRetransmits 0）：状态快照——丢了等下一包（newest-wins）
- 连接建立后信令 KV 记录删除；DataChannel `onclose` → 回菜单并提示

## 4. 二进制消息协议（ArrayBuffer，非 JSON）

统一封装：`[u8 type][u16 payloadLen][payload]`

| type | 通道 | 方向 | 频率 | 载荷 |
|---|---|---|---|---|
| 0x01 HELLO | rel | 双向 | 1 次 | {protoVer u8, name str32, seed u32, scale u8} |
| 0x02 INPUT | unrel | C→H | 50Hz | {seq u16, btn u8(bit: fire/ads/jump/crouch/prone/interact/flare), yaw f32, pitch f32, mx i8, mz i8} |
| 0x03 SNAPSHOT | unrel | H→C | 20Hz | {tick u16, self{pos f32×3, yaw f32, pitch f32, hp u8}, enemies[n]{x f32, z f32, yaw i8, hp u8, flags u8}, tank{x f32, z f32, yaw i8, hp u16}?} |
| 0x04 EVENT | rel | 双向 | 事件 | {evt u8(shot/hit/kill/expl/medkit/mission/stance), args…} |
| 0x05 PING | rel | 双向 | 2Hz | {t f32}（RTT 显示在 HUD） |

- 敌人快照只发**活跃（alive）**敌人：24 敌 × ~14B ≈ 340B/包 × 20Hz ≈ 7KB/s ✓
- 文本（房间码/玩家名）全部走 HELLO/EVENT 的 rel 通道

## 5. 同步模型（Host 权威）

- **Host 模拟**：敌人 AI、物理、任务、医疗包、桶、爆炸——现有单机逻辑原样运行
- **Client 渲染**：远端玩家 = 本地幽灵实体（快照插值，100ms 缓冲）；敌人 = 快照位置插值 + 受击反馈（无本地 AI）
- **Client 命中申报**：client 的射线在本地做（视觉即时），命中敌人 → `HIT` 事件 → host 用权威位置校验（容差 2.5m）→ 通过才结算伤害（防作弊底线）
- **拾取/任务**：全部 host 判定，client 收 EVENT 更新 HUD
- **载具**：阶段 1 联机禁用（驾驶为 host 专属；client 收坦克广播位置用于渲染敌 AI 坦克）
- **任务/胜利**：host 判定 → EVENT 广播 → 双方进结算

## 6. 房间状态机（每端）

```
menu ──创建──► HOST_OFFER_WRITTEN ──answer 收到──► CONNECTING ──DC open──► HANDSHAKE ──► PLAYING
menu ──加入───► JOIN_OFFER_FETCHED ──answer 写入──► CONNECTING ──DC open──► HANDSHAKE ──► PLAYING
任意态 ──失败/断开──► 回菜单 + 明确错误提示（含"网络无法直连"）
```

## 7. 文件清单

| 文件 | 职责 |
|---|---|
| `functions/api/net/[[path]].ts` | Pages Functions 信令端点（KV 读写，4 端点） |
| `src/net/signaling.ts` | 信令客户端（创建/取 offer/写 answer/轮询，KV TTL 管理） |
| `src/net/peer.ts` | RTCPeerConnection 封装（DC 建立、ICE 收集、双通道、断线事件） |
| `src/net/protocol.ts` | 二进制编解码（全部消息类型读写函数）+ 常量表 |
| `src/net/netplay.ts` | 高层：host/join 模式切换、tick 循环、快照打包、幽灵玩家实体、事件分发 |
| `src/ui/netmenu.ts` | 菜单联机 UI（创建/加入/房间码显示/连接状态） |
| `src/core/game.ts`（集成点） | host/client 分支：client 侧敌人插值渲染、事件路由、联机禁载具 |

## 8. UI 流程（菜单）

```
主菜单：[开始游戏] [游戏设置] [操作说明] [联机合作]
联机页：[创建房间] → 显示房间码 + "等待玩家…"（轮询）
        [加入房间] → 输 4 位房间码 → 连接中…
        双方就绪 → "开始行动"（host 点，client 自动跟随进入）
```

## 9. 实施顺序（阶段 1 拆分）

- **M1 连接骨架**：Pages Functions 信令 + peer.ts + 房间码 UI + DC 打通（先传文本验证）
- **M2 状态同步**：protocol.ts + 快照/输入循环 + 幽灵玩家 + 敌人插值
- **M3 事件**：开火/命中申报验证/击杀/拾取/任务广播 + 呼救/救援联机化
- **M4 打磨**：RTT 显示、断线提示、插值参数调优、联机禁载具提示
- 每个里程碑：tsc/test/site-audit/model-audit/build 全绿后进下一个

## 9b. 休闲 PvP 模式（猎杀 FFA）

- 模式选择在联机页：合作（打 AI）/ 猎杀（玩家互搏）
- 猎杀规则：无 AI 敌人；死亡 3 秒后在随机出生点满状态复活；先到 15 杀或 10 分钟结束，计分板结算
- 伤害验证：所有玩家互伤由 host 校验（client 申报命中 → host 按权威位置/冷却验证 → 广播结算）——host 有主场优势，休闲定位可接受
- 计分板：SNAPSHOT 附带每玩家 kills，全屏地图/结算页展示
- 团队版（2v2/4v4）列为阶段 2 候选——FFA 先行最简

## 9c. 8 人容量核算

| 项 | @8 人 |
|---|---|
| host 上行 | 7 peers × ~13KB/s 快照 ≈ 91KB/s（家用上行 5Mbps+ 轻松） |
| host CPU | 7 远端玩家插值 + 事件处理，远低于帧预算 |
| DataChannel | 星型 8 条（host 为中心），浏览器无数量限制 |
| 结论 | **8 人直接全开**；>8（16+）才需要中继/SFU（阶段 3） |

## 10. 明确不做（阶段 1 边界）

TURN 中继（要绑卡，STUN-only 覆盖不到的玩家提示换网络）、WebTransport 回落（阶段 2）、host 迁移（主机退出=解散，提示即可）、语音、团队 PvP（FFA 已含）、>8 人（16+ 需 SFU）、联机模式下的坦克驾驶（吉普可用）

## 11. 风险与缓解

| 风险 | 概率 | 缓解 |
|---|---|---|
| 对称 NAT 穿透失败 | ~10-15%（家用网为主） | 明确错误提示；文档建议手机热点中转 |
| KV 免费额度 | 低（握手低频） | TTL 300s 自动过期 + 用后即删 |
| host 卡顿影响双方体验 | 中 | host 帧率低于 30 时提示；快照间隔自适应 |
| 版本不一致（两端代码不同） | 低 | HELLO 带 protoVer，不匹配拒绝并提示刷新 |
