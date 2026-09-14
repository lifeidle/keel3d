# 部署 KeeL 3D 站点（用户可直接访问）

目标域名：**https://3d.specul.com**（`public/CNAME` 已写入构建产物）。

## 产物

```bash
npm ci
npm run build
# dist/：hub · 各骨架 · wasm/音频
```

- `/` → `hub.html`（选型 + 15 分钟路径）  
- 完整 FPS 样例：`/fps.html`  
- 旗舰可通关：`/roguelike.html`  
- **WebGPU-only**（无 WebGL 回退）

## 方式一：GitHub Pages（推荐，Actions 自动）

1. Settings → Pages → Source：**GitHub Actions**  
2. 推送 `master` 后自动 build 并发布 `dist/`  
3. Custom domain：`3d.specul.com`，按提示配置 DNS，勾选 Enforce HTTPS  

## 方式二：Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy dist --project-name keel3d
```

`wrangler.toml` → `pages_build_output_dir = "dist"`。

## 验证清单

- [ ] `https://3d.specul.com/` 打开 hub  
- [ ] `/roguelike.html` 可玩  
- [ ] `/fps.html` 完整样例  
- [ ] 无 WebGPU 时显示升级提示  
- [ ] hub 上 GitHub 链接可点  

## 站点 vs 仓库

| 站点 | GitHub |
|---|---|
| 演示 + 上手门面 | 源码 · Issue · `new-game` |
| 只发布 `dist/` | 不部署源码树 |
