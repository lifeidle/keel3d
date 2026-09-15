// i18n: locale detection + dictionary + manual toggle.
// Default language follows the browser / OS locale; a 中/EN button lets the
// player override it, and the choice is persisted in localStorage.

export type Locale = 'zh' | 'en';

const STRINGS: Record<string, { zh: string; en: string }> = {
  // menu / screens
  'menu.logo':     { zh: '夜 袭',                  en: 'NIGHT RAID' },
  'menu.sub':      { zh: '夜战行动',               en: 'NIGHT OPERATIONS' },
  'menu.tagline':  { zh: '—— 潜入敌后 · 肃清战场 ——', en: '—— STRIKE FROM THE DARK ——' },
  'menu.play':     { zh: '单 人 游 戏', en: 'SINGLE PLAYER' },
  'menu.settings': { zh: '游 戏 设 置',            en: 'SETTINGS' },
  'menu.time':     { zh: '时 段',                  en: 'TIME OF DAY' },
  'time.night':    { zh: '黑 夜',                  en: 'NIGHT' },
  'time.day':      { zh: '白 天',                  en: 'DAY' },
  'menu.scale':    { zh: '规 模',                  en: 'OPERATION SIZE' },
  'scale.patrol':  { zh: '巡 侦',                  en: 'PATROL' },
  'scale.standard':{ zh: '标 准',                  en: 'STANDARD' },
  'scale.grand':   { zh: '会 战',                  en: 'GRAND' },
  'scale.patrol.hint':  { zh: '敌 6 · 友 3',   en: '6 ENEMIES · 3 SQUAD' },
  'scale.standard.hint':{ zh: '敌 12 · 友 8',  en: '12 ENEMIES · 8 SQUAD' },
  'scale.grand.hint':   { zh: '敌 32 · 友 24', en: '32 ENEMIES · 24 SQUAD' },
  'menu.back':     { zh: '返 回',                  en: 'BACK' },
  'set.title':     { zh: '游 戏 设 置',            en: 'SETTINGS' },
  'set.language':  { zh: '语言',                   en: 'LANGUAGE' },
  'set.sens':      { zh: '鼠标灵敏度',             en: 'MOUSE SENSITIVITY' },
  'set.volume':    { zh: '总音量',                 en: 'MASTER VOLUME' },
  'pause.title':   { zh: '暂 停',                  en: 'PAUSED' },
  'pause.resume':  { zh: '继 续 战 斗',            en: 'RESUME' },
  'pause.settings':{ zh: '游 戏 设 置',            en: 'SETTINGS' },
  'pause.quit':    { zh: '退 出 战 役',            en: 'ABORT OPERATION' },
  'end.win':       { zh: '✔ 任务完成',             en: '✔ MISSION COMPLETE' },
  'end.lose':      { zh: '✖ 行动失败',             en: '✖ KILLED IN ACTION' },
  'end.timeout':   { zh: '✖ 时间耗尽',             en: '✖ OUT OF TIME' },
  'end.again':     { zh: '再 来 一 局',            en: 'NEW OPERATION' },
  'end.menu':      { zh: '返 回 主 菜 单',          en: 'MAIN MENU' },
  'stat.kills':    { zh: '击杀',                   en: 'KILLS' },
  'stat.time':     { zh: '用时',                   en: 'TIME' },

  // HUD
  'hud.enemies':   { zh: '敌军剩余', en: 'ENEMIES' },
  'hud.squad':     { zh: '小队',     en: 'SQUAD' },
  'hud.allyDown':  { zh: '队友阵亡', en: 'SQUADMATE DOWN' },
  'hud.allyKill':  { zh: '友军击敌', en: 'SQUAD KILL' },
  'hud.health':    { zh: '生命',     en: 'HEALTH' },
  'hud.armor':     { zh: '装甲',     en: 'ARMOUR' },
  'hud.reload':    { zh: '换弹',     en: 'RELOAD' },
  'hud.kill':      { zh: '击 杀',    en: 'KILL' },

  // tank driving HUD line
  'tank.exit':     { zh: 'F 下车',   en: 'F to dismount' },
  'set.quality':   { zh: '画质',     en: 'QUALITY' },

  // Jeep (X package)
  'jeep.driveHint':{ zh: 'W/S 油门 · A/D 转向 · C 视角 · F 下车', en: 'W/S throttle · A/D steer · C camera · F dismount' },
  'jeep.destroyed':{ zh: '侦察车被毁', en: 'scout jeep destroyed' },

  // day/night recon coupling
  'tactic.night':  { zh: '夜间：敌视距 -45%，潜行接近', en: 'NIGHT: enemy vision -45% — sneak close' },
  'tactic.day':    { zh: '白天：视野开阔，注意暴露', en: 'DAY: long sightlines — stay in cover' },
  'tactic.searchlit': { zh: '⚠ 你被探照灯照到了！', en: '⚠ CAUGHT IN THE SEARCHLIGHT!' },

  // squad commands (X key)
  'cmd.label':     { zh: '小队指令', en: 'SQUAD' },
  'cmd.follow':    { zh: '跟 随 我', en: 'FOLLOW ME' },
  'cmd.assault':   { zh: '向 敌 推 进', en: 'ASSAULT' },
  'cmd.hold':      { zh: '原 地 据 守', en: 'HOLD POSITION' },
  'cmd.nobody':    { zh: '小队无人', en: 'No squad members' },
  'op.deploy':     { zh: '正在部署新战场…', en: 'Deploying a new battlefield…' },

  // kill-streak milestones
  'streak.3':      { zh: '三 连 杀', en: 'TRIPLE KILL' },
  'streak.5':      { zh: '势 不 可 挡', en: 'UNSTOPPABLE' },
  'streak.8':      { zh: '战 场 主 宰', en: 'REAPER' },

  // resupply points
  'resupply.hint': { zh: '按 F 补充弹药', en: 'F — resupply ammo' },
  'resupply.done': { zh: '弹药已补满', en: 'Ammo resupplied' },
  'rescue.hint':   { zh: '按 F 扶起队友', en: 'F — pick up squadmate' },
  'rescue.done':   { zh: '队友已救起', en: 'Squadmate revived' },

  // controls help (menu)
  'keys.title':    { zh: '操作说明 / CONTROLS', en: 'CONTROLS / 操作说明' },
  'keys.move':     { zh: '移动', en: 'Move' },
  'keys.run':      { zh: '奔跑', en: 'Sprint' },
  'keys.jump':     { zh: '跳跃', en: 'Jump' },
  'keys.crouch':   { zh: '蹲下（按住）', en: 'Crouch (hold)' },
  'keys.prone':    { zh: '趴下（切换）', en: 'Prone (toggle)' },
  'keys.fire':     { zh: '开火', en: 'Fire' },
  'keys.ads':      { zh: '开镜（切换）', en: 'Aim sights (toggle)' },
  'keys.reload':   { zh: '换弹', en: 'Reload' },
  'keys.weap':     { zh: '切换武器', en: 'Switch weapon' },
  'keys.inter':    { zh: '互动（载具/补给/救援）', en: 'Interact (vehicle/resupply/rescue)' },
  'keys.cmd':      { zh: '小队指令', en: 'Squad orders' },
  'keys.map':      { zh: '战术地图', en: 'Tactical map' },
  'keys.flare':    { zh: '信号弹', en: 'Signal flare' },

  // netplay room
  'menu.net':      { zh: '联 机 对 战', en: 'MULTIPLAYER' },
  'net.title':     { zh: '联 机 合 作', en: 'CO-OP ONLINE' },
  'net.host':      { zh: '创 建 房 间', en: 'CREATE ROOM' },
  'net.join':      { zh: '加 入 房 间', en: 'JOIN ROOM' },
  'net.coop':      { zh: '合 作', en: 'CO-OP' },
  'net.hunt':      { zh: '猎 杀', en: 'HUNT' },
  'net.waiting':   { zh: '等待玩家加入…', en: 'Waiting for a player…' },
  'net.connecting':{ zh: '玩家已加入——建立直连…', en: 'Player joined — establishing direct link…' },
  'net.go':        { zh: '连 接', en: 'CONNECT' },
  'net.ready':     { zh: '已连接——正在部署战场…', en: 'Connected — deploying battlefield…' },

  // help screen
  'menu.help':     { zh: '操 作 说 明', en: 'HOW TO PLAY' },
  'help.title':    { zh: '操 作 说 明', en: 'HOW TO PLAY' },
  'help.back':     { zh: '返 回', en: 'BACK' },
  'help.goal':     { zh: '任务目标', en: 'OBJECTIVE' },
  'help.goalText': { zh: '消灭战区内全部敌军即可获胜。敌军会分路推进，留意左上角小队数量与 M 键战术地图。', en: 'Eliminate every hostile in the area to win. They push in from multiple directions — watch the squad counter and the M tactical map.' },
  'help.keys':     { zh: '键位操作', en: 'CONTROLS' },
  'help.squad':    { zh: '小队协同', en: 'SQUAD TACTICS' },
  'help.squad1':   { zh: 'X 键切换小队指令：跟随我 / 向敌推进 / 原地据守。', en: 'X cycles squad orders: follow me / assault / hold position.' },
  'help.squad2':   { zh: '你开枪时会向附近队友共享火力方向——他们会主动支援。', en: 'Your gunfire shares the aim point with nearby squadmates — they will support you.' },
  'help.squad3':   { zh: '队友倒地后会呼救（25 秒窗口），靠近按 F 扶起；倒地再挨打会阵亡。', en: 'Downed squadmates call for help (25s window) — get close and press F; another hit while down is fatal.' },
  'help.squad4':   { zh: '弹药堆（青色菱形标记）可一次性补满全部备弹，每处限用一次。', en: 'Ammo dumps (cyan diamonds) refill all reserves once each.' },
  'help.field':    { zh: '战场须知', en: 'FIELD NOTES' },
  'help.field1':   { zh: '夜间敌军视距下降 45%——潜伏接近更安全；但探照灯会暴露你的位置。', en: 'At night enemy vision drops 45% — sneaking is safer, but searchlights give you away.' },
  'help.field2':   { zh: '敌人有 5 种兵种：步枪 / 冲锋枪 / 狙击（红激光预警）/ 机枪压制 / RPG（火箭可躲）。', en: 'Five hostile types: rifle / SMG / marksman (red laser warning) / LMG suppression / RPG (dodgeable rockets).' },
  'help.field3':   { zh: '红色油桶可以引爆——敌人躲在后面时，射桶不射人。', en: 'Red fuel drums explode — when hostiles hide behind them, shoot the drums instead.' },
  'help.field4':   { zh: '蹲下（Ctrl）和趴下（Z）能大幅缩小你的暴露轮廓。', en: 'Crouch (Ctrl) and prone (Z) shrink your exposure profile dramatically.' },
  'help.field5':   { zh: '敌营边缘和基地附近各有一处弹药补给；M 键随时打开战术地图。', en: 'An ammo dump sits by each camp edge; M opens the tactical map anytime.' },
  'help.credits':      { zh: '素材与致谢', en: 'ASSETS & CREDITS' },
  'help.creditsText':  { zh: '游戏源代码以 MIT 许可发布。音频与纹理来自 OpenGameArt、Kenney、incompetech 与 AmbientCG 等开放素材库（CC0 / CC-BY），其中 CC-BY 素材的必需署名如下：', en: 'The source code is released under the MIT license. Audio and textures come from OpenGameArt, Kenney, incompetech and AmbientCG (CC0 / CC-BY). Required CC-BY attributions:' },
  'help.creditsTail':  { zh: '完整许可清单与必需署名见 keel.specul.com/credits.html，网站条款见 specul.com/legal.html；仓库内另见 docs/THIRD_PARTY_NOTICES.md。', en: 'Full licence register: keel.specul.com/credits.html · site terms: specul.com/legal.html · repo: docs/THIRD_PARTY_NOTICES.md.' },
  'help.disclaimer':   { zh: '免责声明', en: 'DISCLAIMER' },
  'help.disclaimerText': { zh: '本游戏按"现状"提供，不附带任何明示或默示的保证。游戏内容纯属虚构，与任何现实人物、组织或事件无关。使用者需自行承担运行本游戏所产生的设备与数据风险，作者与分发者对任何直接或间接损失概不负责。各第三方素材依其原始许可条款提供。', en: 'This game is provided "as is", without warranty of any kind, express or implied. All content is fictional and unrelated to any real person, organization or event. Use at your own risk; the authors and distributors are not liable for any direct or indirect damages. Third-party assets are provided under their respective licenses.' },

  // weapon slots
  'weapon.rifle':   { zh: '步枪',     en: 'RIFLE' },
  'weapon.smg':     { zh: '冲锋枪',   en: 'SMG' },
  'weapon.carbine': { zh: '卡宾枪',   en: 'CARBINE' },
  'weapon.bolt':    { zh: '栓动步枪', en: 'BOLT RIFLE' },

  // mission objectives (picked from the map seed)
  'mission.eliminate':      { zh: '攻 营',   en: 'STORM THE CAMP' },
  'mission.eliminate.desc': { zh: '随班组推进，攻入敌方营地肃清敌军', en: 'Advance with your squad and clear the enemy camp' },
  'mission.extract':        { zh: '撤 离',   en: 'EXFILTRATE' },
  'mission.extract.desc':   { zh: '攻入敌营肃清敌军，随后抵达撤离点', en: 'Storm the camp, then reach the exfil zone' },
  'mission.assault':        { zh: '突 击',   en: 'ASSAULT' },
  'mission.assault.desc':   { zh: '限时内攻入敌方营地并肃清敌军', en: 'Storm the enemy camp before the clock runs out' },
  'mission.capture':        { zh: '夺 旗',   en: 'CAPTURE' },
  'mission.capture.desc':   { zh: '攻入敌营，占领敌军旗帜',     en: 'Seize the enemy camp flag' },
  'flag.captured':          { zh: '敌军旗帜易主',              en: 'CAMP CAPTURED' },
  'flag.contest':           { zh: '敌军反扑！',                en: 'COUNTERATTACK' },
  'obj.exfil':              { zh: '前往撤离点',               en: 'GO TO EXFIL' },

  // weather (seeded per operation)
  'weather.clear':  { zh: '晴',     en: 'CLEAR' },
  'weather.mist':   { zh: '薄雾',   en: 'MIST' },
  'weather.rain':   { zh: '雨',     en: 'RAIN' },
  'weather.storm':  { zh: '暴雨',   en: 'STORM' },
  'wx.label':       { zh: '天气',   en: 'WX' },
  'quality.low':   { zh: '低画质', en: 'LOW' },
  'quality.med':   { zh: '中画质', en: 'MED' },
  'quality.high':  { zh: '高画质', en: 'HIGH' },
  'note.touch':    { zh: '本作为FPS 骨架，需要鼠标与键盘操作；触屏设备体验受限。', en: 'This is a first-person shooter — a mouse and keyboard are required. Touch devices are only partially supported.' },

  // tanks (H package)
  'tank.board':      { zh: '[F] 登车 — 驾驶坦克',         en: '[F] BOARD TANK' },
  'tank.driveHint':  { zh: '[F] 下车 · [C] 切换视角 · 左键开炮', en: '[F] EXIT · [C] CAMERA · LMB FIRE' },
  'tank.gunner':     { zh: '炮手视角',                     en: 'GUNNER VIEW' },
  'tank.chase':      { zh: '尾随视角',                     en: 'CHASE VIEW' },
  'tank.destroyed':  { zh: '敌方坦克被摧毁',               en: 'ENEMY TANK DESTROYED' },

  // messages
  'hint.start':    { zh: '1–4 / 滚轮切换武器。清除所有敌军。ESC 暂停。', en: 'Switch guns with 1–4 / scroll. Eliminate all hostiles. ESC to pause.' },
  'kill.down':     { zh: '目标清除', en: 'target down' },
  'kill.boom':     { zh: '爆炸清除', en: 'blown up' },
  'boot.fail':     { zh: '启动失败', en: 'LAUNCH FAILED' },
  'boot.loading':  { zh: '正在初始化战场…', en: 'Initializing battlefield…' },

  // Page <title> + share-card copy (switched fully per locale, no mix).
  'meta.title':    { zh: 'FPS 骨架', en: 'NIGHT RAID' },
  'meta.desc':     { zh: '离线可玩的 Three.js 夜战 FPS：种子化随机战场、任务目标、可破坏掩体、动态天气。', en: 'An offline, seeded night-raid FPS built with Three.js — randomized battlefields, objectives, destructible cover, and dynamic weather.' },

  // Label shows the language you would switch TO.
  'lang.toggle':   { zh: 'EN', en: '中' },

  // Fullscreen corner button + one-time invitation toast
  'fs.tip':        { zh: '全 屏', en: 'FULLSCREEN' },
  'fs.q':          { zh: '进入全屏体验更佳？', en: 'Go fullscreen for the best experience?' },
  'fs.enter':      { zh: '进入全屏', en: 'FULLSCREEN' },
  'fs.skip':       { zh: '暂不需要', en: 'NOT NOW' },

  // Touch controls / mobile
  'rotate.hint':   { zh: '请横屏游玩', en: 'ROTATE TO LANDSCAPE' },
  'set.sensTouch': { zh: '触屏灵敏度', en: 'TOUCH SENSITIVITY' },
  'set.gyro':      { zh: '陀螺仪瞄准', en: 'GYRO AIM' },
  'set.gyroOn':    { zh: '开 启', en: 'ON' },
  'set.gyroOff':   { zh: '关 闭', en: 'OFF' },
  'set.sensGyro':  { zh: '陀螺仪灵敏度', en: 'GYRO SENSITIVITY' },
  'hint.gyroDeny': { zh: '陀螺仪权限被拒绝，可在系统设置中允许', en: 'Gyro permission denied — allow it in system settings' },
  'hint.autoQuality': { zh: '检测到帧率偏低，已自动降低画质以保持流畅', en: 'Low frame rate detected — quality lowered automatically' },
  'set.toggles':   { zh: '声音开关', en: 'SOUND TOGGLES' },
  'set.bgmOn':     { zh: '音乐 开', en: 'MUSIC ON' },
  'set.bgmOff':    { zh: '音乐 关', en: 'MUSIC OFF' },
  'set.sfxOn':     { zh: '音效 开', en: 'SFX ON' },
  'set.sfxOff':    { zh: '音效 关', en: 'SFX OFF' },
  'set.btnSize':   { zh: '按钮大小', en: 'BUTTON SIZE' },
  'set.btnSmall':  { zh: '小', en: 'SMALL' },
  'set.btnMid':    { zh: '中', en: 'MEDIUM' },
  'set.btnLarge':  { zh: '大', en: 'LARGE' },
};

const STORAGE_KEY = 'sf-locale';
const listeners = new Set<(l: Locale) => void>();
let current: Locale = detectLocale();

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    /* localStorage may be unavailable */
  }
  const nav = (navigator.language || 'zh-CN').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(l: Locale) {
  current = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  applyStatic();
  listeners.forEach((fn) => fn(l));
}

export function toggleLocale() {
  setLocale(current === 'zh' ? 'en' : 'zh');
}

export function onLocaleChange(fn: (l: Locale) => void) {
  listeners.add(fn);
}

export function t(key: string): string {
  const entry = STRINGS[key];
  return entry ? entry[current] : key;
}

export function applyStatic(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });
}

/** Update the document title and the Open Graph / Twitter share-card tags so
 *  the page title switches fully to the active language (no zh/en mix). */
export function applyMeta() {
  document.title = t('meta.title');
  const set = (sel: string, attr: string) => {
    const el = document.head.querySelector(sel) as HTMLElement | null;
    if (el) el.setAttribute(attr, t('meta.desc'));
  };
  set('meta[property="og:title"]', 'content');
  set('meta[name="twitter:title"]', 'content');
  set('meta[property="og:description"]', 'content');
  set('meta[name="twitter:description"]', 'content');
  const desc = document.head.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (desc) desc.content = t('meta.desc');
}

export function initI18n(opts: { setDocumentTitle?: boolean } = {}) {
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
  applyStatic();
  if (opts.setDocumentTitle) {
    applyMeta();
  } else {
    // only refresh description meta; keep the HTML page's own <title>
    const desc = document.head.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (desc) desc.content = t('meta.desc');
  }
  const btn = document.getElementById('lang-toggle');
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLocale();
  });
}
