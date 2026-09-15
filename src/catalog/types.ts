/**
 * Catalog types — the single source of truth for the showcase (演示站) and the
 * recipe list. Data lives in ./catalog.json; generators live in scripts/.
 *
 * 维护入口：只改 ./catalog.json，然后 `npm run catalog:gen`。
 * 校验：`npm run catalog:check`（CI 强制零漂移）。
 */

/** 演示站卡片的成熟度。playable = 有完整胜负/结算；skeleton = 可探索无结算；template = 空白起点。 */
export type GenreStatus = 'playable' | 'skeleton' | 'template';

/** 一个品类 = 一个可独立打开的 HTML 演示入口。 */
export interface GenreCard {
  /** 卡片与 catalog 内的唯一键（同时用于 <id>.html 之外的身份标识） */
  id: string;
  /** src/registry.ts 的 GAME_LOADERS 键（决定启动哪个内容包） */
  gameId: string;
  /** 内容包模块路径，用于生成 registry：'./game/demo-arpg' */
  gameModule: string;
  /** 页面文件主干名：`<page>.html`（与 vite 入口键一致） */
  page: string;
  /** 卡片图标（emoji） */
  icon: string;
  /** 卡片标题 */
  title: string;
  /** 一句话卖点 */
  blurb: string;
  /** 标签（展示用） */
  tags: string[];
  /** 使用的配方 slug（见 Catalog.recipes）；骨架页为 null */
  recipe: string | null;
  /** 卡片「规格」键值对，直接渲染到详情面板 */
  spec: Record<string, string>;
  /** 仓库内脚手架命令 */
  cmd: string;
  /** 仓库外脚手架命令（P1 的 create-keel3d） */
  createCmd: string;
  /** 玩法/操作/胜负说明 */
  note: string;
  /** [积木名, 用途] 列表 */
  blocks: [string, string][];
  /** 缩略图相对路径（相对站点根，如 './shots/arpg.webp'）；未生成时为 null */
  thumb: string | null;
  status: GenreStatus;
  /**
   * 是否出现在官方演示站（hub.html）卡片里，默认 true。
   * `npm run new-game` 生成的用户游戏包会写成 false —— 仍然注册进 registry、
   * 参与 vite 构建与浏览器探针，只是不进官方展示台。
   */
  showcase?: boolean;
}

/** 一条配方 = recipes/<file>.ts 的默认导出，可被 new-game / create-keel3d 直接使用。 */
export interface RecipeDef {
  /** --recipe 的值（new-game.mjs 与 create-keel3d 的参数） */
  slug: string;
  /** 导出的工厂函数名 */
  export: string;
  /** src/recipes/<file>.ts */
  file: string;
  /** 中文名 */
  title: string;
  /** 关联的演示页 page（无独立页面时为 null，仅能通过 new-game 使用） */
  page: string | null;
  /** 一句话说明 */
  blurb: string;
}

export interface Catalog {
  version: number;
  updated: string;
  genres: GenreCard[];
  recipes: RecipeDef[];
}
