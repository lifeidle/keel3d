# THIRD-PARTY NOTICES — KeeL 3D

本仓库的**框架源代码**以 MIT 许可发布（见根目录 `LICENSE`）。
**MIT 不覆盖**第三方代码依赖、解码器二进制、以及 `public/` 下的音频 / 纹理 / 模型。
再分发完整构建（尤其是FPS 骨架 Sample A 的 dist）时，请保留本文件与游戏内「素材与致谢」。

---

## 1. 运行时 / 开发依赖（npm）

| 组件 | 版本（本仓库锁定参考） | 许可 | 说明 |
|---|---|---|---|
| three.js | 0.186.x | **MIT** | 渲染；含 addons（GLTF/DRACO/KTX2 Loader） |
| @dimforge/rapier3d | 0.20.x | **Apache-2.0** | 物理 wasm |
| @dimforge/rapier3d-compat | 0.20.x | **Apache-2.0** | 仅测试管线 alias |
| vite | 8.3.x | **MIT** | 构建 |
| typescript | 7.x | **Apache-2.0** | 类型检查 |
| playwright | 1.63.x | **Apache-2.0** | 仅开发测试 |
| @gltf-transform/* | 4.5.x | **MIT** | 仅资产转码工具 |
| draco3d（npm） | 1.5.x | **Apache-2.0** | 转码用 |
| meshoptimizer | 1.2.x | **MIT** | 转码用 |
| sharp | 0.34.x | **Apache-2.0** | 仅开发图像处理 |
| wrangler | 4.131.x | **MIT OR Apache-2.0** | 仅部署 CLI |

Apache-2.0 组件：分发时请保留其许可与版权声明（通常随 node_modules 或 NOTICE；本表作汇总说明）。

---

## 2. 浏览器端解码器（`public/`）

| 文件 | 来源 | 许可 |
|---|---|---|
| `public/draco/gltf/*` | Google Draco（three.js 附带副本） | **Apache-2.0** |
| `public/basis/basis_transcoder.*` | Basis Universal / Binomial（three.js 附带副本） | **Apache-2.0** |

---

## 3. 3D 模型（`public/models/`，FPS 骨架样例）

| 文件 | 来源 | 许可 |
|---|---|---|
| `soldier.glb` | Quaternius「Animated Men」等 | **CC0 1.0** |
| `rifle.glb` | Quaternius Assault Rifle | **CC0 1.0** |
| `tank.glb` | Quaternius Tank | **CC0 1.0** |

> 代码注释中记录了 Quaternius / CC0；若你替换为自己的模型，只需遵守该模型自己的许可。

---

## 4. 纹理（`public/textures/`）

| 资产 | 来源 | 许可 |
|---|---|---|
| sand / concrete / plywood / rusty_metal / corrugated_iron / rock 等 diffuse+normal | AmbientCG 衍生 | **CC0** |

---

## 5. 音频（`public/audio/`，主要在FPS 骨架样例）

| 资产 | 作者 | 许可 |
|---|---|---|
| layer_battle.mp3「Open Warfare」 | Ruskerdax | **CC0 1.0** |
| layer_tense.mp3「Crypto」 | Kevin MacLeod (incompetech.com) | **CC-BY 4.0** |
| layer_calm.mp3「Long Note Two」 | Kevin MacLeod (incompetech.com) | **CC-BY 4.0** |
| jingle_*.ogg | Kenney | **CC0 1.0** |
| 枪声 cz / mosin / shotty / sks | Vincent Sevedge | **CC-BY 3.0** |
| boom_new.wav | OpenGameArt | **CC0** |
| impact / mechanical / vehicles 等 | Kenney | **CC0** |
| s_bird_a.ogg | isaiah658 | **CC0** |
| 英语无线电语音 | SoundBiterSFX | **CC-BY-SA 4.0** |
| 英语士兵语音 | Bigz1983 (OpenGameArt) | **CC-BY 3.0** |
| 中文语音 voice_cn | 本项目 Windows TTS（Huihui）本地合成 | **无第三方权利** |

**注意 CC-BY-SA 4.0**：若你**公开发布**仍包含该组英语语音的完整游戏构建，需按其条款署名；若对音频本身进行改编再分发，可能触发 **ShareAlike**。不想承担该义务时：删除 `public/audio/sfx/voice_en/` 中来自 Radio Soldier 的文件，或换成自有/CC0 语音。

---

## 6. 必需署名（CC-BY / CC-BY-SA 摘要）

请在文档、游戏致谢页或关于页保留类似文本：

```
Gun sounds by Vincent Sevedge, licensed under Creative Commons Attribution 3.0 Unported.
http://creativecommons.org/licenses/by/3.0/

"Radio Soldier" announcer lines by SoundBiterSFX, licensed under Creative Commons
Attribution-ShareAlike 4.0. http://creativecommons.org/licenses/by-sa/4.0/

Soldier voice acting from OpenGameArt (user "Bigz1983"), CC-BY 3.0.

"Crypto" and "Long Note Two" by Kevin MacLeod (incompetech.com), licensed under
Creative Commons: By Attribution 4.0. http://creativecommons.org/licenses/by/4.0/

Three.js, Rapier, Draco, Basis transcoder — see their respective licenses
(MIT / Apache-2.0).
```

游戏内已同步展示于「操作说明 → 素材与致谢」。

**线上对应页面**（对外可引用的规范地址）：

- 完整素材与许可清单：<https://keel.specul.com/credits.html>
- 站点法律条款（自有内容 / 第三方组件 / 免责 / 隐私）：<https://specul.com/legal.html>

向公众分发在线演示时，站点级署名即由上面两页承担；只发布「你自己的游戏 + 自有素材」时无需引用它们。

---

## 7. 商用快速结论

| 你要分发的内容 | 可以商用？ | 你要做的事 |
|---|---|---|
| **仅框架源码**（不含 public 素材） | ✅ 可以 | 保留 MIT 版权与许可文本 |
| **你自己的游戏**（自有模型/音频） | ✅ 可以 | 遵守 three/Rapier 等 MIT/Apache；自有素材自担 |
| **完整FPS 骨架样例构建**（含 CC-BY 音频） | ✅ 可以 | 完整署名；注意 CC-BY-SA 语音的 SA 义务或移除该语音 |
| **声称 Specul / KeeL 商标** | — | MIT 不含商标授权；品牌使用请遵循常识与法律 |

更完整的条款与免责见 **`docs/LEGAL.md`**。
