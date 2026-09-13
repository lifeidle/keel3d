# KeeL 3D

**Browser-native 3D game foundation** (WebGPU + three.js + Rapier + TypeScript).  
Part of [Specul](https://specul.com) · GitHub: https://github.com/lifeidle/keel3d · npm: `keel3d`

Stop rebuilding the engine. Clone, fill in **models + gameplay + scene**, and ship web 3D games as static sites.

| | |
|---|---|
| Rendering | **WebGPU only** (three.js; no WebGL fallback) |
| Physics | Rapier3D |
| Stack | TypeScript + Vite |
| License | MIT (code) · see notices for assets |

> Requires a WebGPU browser (recent Chrome / Edge, Safari 17+).

**English:** [User Guide](docs/USER_GUIDE.en.md) · [Legal](docs/LEGAL.en.md) · [Third-party notices](docs/THIRD_PARTY_NOTICES.md)  
**中文：** [README.md](README.md) · [使用指南](docs/USER_GUIDE.md)

---

## Skeletons (standalone HTML)

| Skeleton | Entry | Notes |
|---|---|---|
| **FPS** | [`fps.html`](fps.html) | first-person · seeded maps · optional P2P |
| **Tower defense** | [`tower.html`](tower.html) | fixed lanes · towers · waves/economy |
| **Open world** | [`openworld.html`](openworld.html) | stream chunks · camera 1/2/3 |
| **Flight** | [`flight.html`](flight.html) | chase · gravity 0 |
| **Racing** | [`race.html`](race.html) | loop track · vehicle |
| **Blank template** | [`template.html`](template.html) | minimal start |
| **Hub** | [`hub.html`](hub.html) | pick skeleton → base + blocks |

Entries are **HTML files only** (no query-string routing).

---

## Quick start

```bash
npm install
npm run build && npm run preview
# open /hub.html or any skeleton page
```

```bash
npm run new-game mygame -- --title "My Game" --html
npm run new-game mytd -- --recipe td --html
```

---

## What you get

Engine kernel, opt-in blocks (pools, paths, steering, cameras, chunks, maps), gameplay blocks (health, waves, economy, placement), UI helpers, and data-driven recipes.

Import **only what you need** — unused blocks stay out of the bundle and the frame loop.

---

## License

- **Source:** MIT — commercial use OK; keep the license notice.  
- **Assets in `public/`:** CC0 / CC-BY / etc. — **not** under MIT.  
- See [docs/LEGAL.en.md](docs/LEGAL.en.md) and [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).
