# 夜袭 / Night Raid

> **本仓库的产品是「可开源 3D 游戏框架」**；夜袭是框架上的 Sample A 内容包之一。
> 框架规划见 `FRAMEWORK_PLAN.md`，目录说明见 `docs/STRUCTURE.md`。

免费、无需安装的网页 3D 夜战 FPS（Sample A）：夜战潜行、种子化随机战场、AI 队友协同、
联机合作与猎杀对战。桌面与手机浏览器即开即玩——**https://yexi.org**

## 特性

- **单机战役**：夜战潜行 FPS，敌军分路推进，占领/歼灭/防守多类任务，坦克与吉普载具
- **联机合作**（P2P，最多 8 人架构）：主机权威模拟，AI 敌我双端同步，救援/补给/胜负联机化
- **PvP 猎杀**：FFA 自由对战，死亡 3 秒复活，先到 15 杀或 10 分钟结算
- **种子化随机战场**：同一 seed 生成完全一致的战场（联机共用 seed）
- **中英双语**：界面与无线电语音双语言（中文语音为本地 TTS 合成）
- **自适应**：分辨率自适应 UI，桌面/移动均可运行

## 技术栈

Three.js（WebGPU 唯一）+ Rapier3D（标准 wasm）+ TypeScript + Vite ·
后端：Cloudflare Pages Functions + KV（信令）·
传输：WebRTC DataChannel（P2P，双通道可靠/不可靠拆分，二进制协议）

## 本地开发

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器（vite）
npm test             # 单元测试（26 项：弹道/弹匣/地形/地图/战斗/网络/积木）
npm run build        # 构建到 dist/
npm run site-audit   # 站点体检
npm run net:dev      # 联机联调服务器（端口 8799，双标签即可测试 P2P）
```

快速上手框架写新游戏：见 **`docs/QUICKSTART.md`**。

## 部署（Cloudflare Pages，免费计划）

```bash
npx wrangler login                          # 一次性授权
npx wrangler pages deploy dist --project-name night-raid --branch main
```

信令 KV：`NET_SIGNALING` namespace（id 见 wrangler.toml）。自定义域名在
Pages 项目 → Custom domains 绑定（当前：yexi.org）。

## 项目结构

完整分层说明见 **`docs/STRUCTURE.md`**。核心：

| 目录 | 用途 |
|---|---|
| `src/engine/` | L1 内核（框架） |
| `src/blocks/` · `src/content/` | L2 积木 / L3 契约 |
| `src/game/nightraid/` | Sample A 内容包 |
| `src/game/demo-tower/` · `demo-cultivation/` | Sample B / C |
| `src/game/demo-flight/` · `demo-race/` · `demo-template/` | 骨架与模板 |
| `public/` | 静态资产源，构建时拷入 dist |
| `functions/` | Pages Functions——联机信令 API |
| `docs/` | QUICKSTART / API / ADAPT / 许可清单 |

联机架构详见 `docs/archive/MULTIPLAYER_PLAN.md`。

## 许可

- 源代码：MIT（见 LICENSE）
- 第三方音频/纹理：CC0 / CC-BY（署名与完整清单见 `docs/THIRD_PARTY_NOTICES.md`
  与游戏内"操作说明 → 素材与致谢"）
- 中文语音：本项目 TTS 本地合成，无第三方权利
- 音乐素材清单：`docs/AUDIO_CREDITS.md`

