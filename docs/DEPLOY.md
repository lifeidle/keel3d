# 部署（两仓模型 · 经典 GitHub Pages · 不用 Actions 发站点）

| 角色 | 仓库 | 分支 | 域名 |
|---|---|---|---|
| 源码 | `lifeidle/keel3d` | `master` | 无（只放代码与文档） |
| 门户 + 演示 | `speculcom/keel` | `main` | `keel.specul.com` |
| 品牌站 | `speculcom/www` | `main` | `specul.com` |

演示站点 = `keel3d/dist` 整树同步到 `keel.specul/3d/` 之后的产物。

## 日常更新（三步）

```bash
cd keel3d && npm run build
cd ../keel.specul && node sync-3d.mjs
# 再把 keel.specul 整个目录上传到 speculcom/keel（main）
```

## 路径

| URL | 内容 |
|---|---|
| `https://keel.specul.com/` | 门户首页（Keel 3D / 2D 选型） |
| `https://keel.specul.com/3d/hub.html` | hub（选型 + 上手） |
| `https://keel.specul.com/3d/roguelike.html` | 旗舰可通关样例 |
| `https://keel.specul.com/3d/fps.html` | 完整 FPS 样例 |

## 说明

- **不要**在 Pages 里选 GitHub Actions；`ci.yml` 只做 typecheck / test / build，与发布无关。
- `npm run deploy:pages` 是源码仓的 gh-pages 历史脚本，**已不是当前发布路径**，保留仅为兼容。
- ⚠️ `public/CNAME` 里仍是旧的 `3d.specul.com`，历史产物会把它带进 `dist/` 与 `keel.specul/3d/`。
  生效的是站点仓根目录那份 `keel.specul/CNAME`（`keel.specul.com`）。
  **不要单独改产物里的 CNAME**——换域名要按 GitHub 重绑流程走，改错会让站点掉线。
- 源码在默认分支；网站只含静态产物，不含源码。
