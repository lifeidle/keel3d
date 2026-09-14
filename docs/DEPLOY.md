# 部署（经典 GitHub Pages · 不用 Actions）

只有一个仓库：`github.com/lifeidle/keel3d`。  
站点 = 构建产物 `dist/`，推到 **`gh-pages` 分支**。

## 一次性设置（你操作）

1. 本地：`npm run deploy:pages`（会 build 并推送 `gh-pages`）  
2. GitHub → Settings → Pages  
   - Source：**Deploy from a branch**  
   - Branch：**gh-pages** / **/** (root)  
3. Custom domain：`3d.specul.com`（CNAME 已在产物里）  
4. DNS：按 GitHub 提示加记录，勾选 Enforce HTTPS  

## 日常更新网站

```bash
npm run deploy:pages
```

## 路径

| URL | 内容 |
|---|---|
| `https://3d.specul.com/` | hub（选型 + 上手） |
| `/roguelike.html` | 旗舰可通关样例 |
| `/fps.html` | 完整 FPS 样例 |
| `/GETTING 相关` | 文档在仓库 `docs/`，站点只放可玩 demo |

## 说明

- **不要**在 Pages 里选 GitHub Actions（本仓不依赖它做发布）  
- `ci.yml` 仅用于代码检查，与网站发布无关  
- 源码始终在默认分支；网站只含 `dist/` 静态文件  
