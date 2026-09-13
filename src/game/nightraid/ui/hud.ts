// HUD controller: health, ammo, enemy count, kill feed, damage flash, hints,
// plus the weapon label (kept in sync across weapon switches and locale flips).
// Also the game-feel layer: dynamic crosshair, hitmarker, damage-direction arc.
import { t, onLocaleChange } from '../../../i18n';
import type { ObjectiveView } from '../world/mission';

export class HUD {
  private healthFill = document.getElementById('health-fill')!;
  private ammoMag = document.getElementById('ammo-mag')!;
  private ammoReserve = document.getElementById('ammo-reserve')!;
  private weaponName = document.getElementById('weapon-name')!;
  private reloadStatus = document.getElementById('reload-status')!;
  private enemyCount = document.getElementById('enemy-count')!;
  private squadCount = document.getElementById('squad-count')!;
  private killfeed = document.getElementById('killfeed')!;
  private damageFlash = document.getElementById('damage-flash')!;
  private hint = document.getElementById('hint')!;
  private objective = document.getElementById('objective')!;
  private objTitle = document.getElementById('obj-title')!;
  private objDesc = document.getElementById('obj-desc')!;
  private objProgress = document.getElementById('obj-progress')!;
  private objTimer = document.getElementById('obj-timer')!;
  private crosshair = document.getElementById('crosshair')!;
  private hitmarker = document.getElementById('hitmarker')!;
  private dmgDir = document.getElementById('dmg-dir')!;
  private fireDir = document.getElementById('fire-dir');
  private hmT = 0;
  private ddT = 0;
  private fdT = 0;
  private weaponKey = 'rifle';

  constructor() {
    this.reloadStatus.textContent = t('hud.reload');
    this.weaponName.textContent = t('weapon.' + this.weaponKey);
    onLocaleChange(() => {
      this.reloadStatus.textContent = t('hud.reload');
      this.weaponName.textContent = t('weapon.' + this.weaponKey);
    });
  }

  /** Slot 1-4 label, e.g. 步枪 / RIFLE. */
  setWeapon(key: string) {
    this.weaponKey = key;
    this.weaponName.textContent = t('weapon.' + key);
  }

  private killBadgeEl = document.getElementById('kill-badge');
  private scopeEl = document.getElementById('scope');

  private lowhp = document.getElementById('lowhp')!;

  setHealth(h: number, max: number) {
    const pct = Math.max(0, Math.min(100, (h / max) * 100));
    this.healthFill.style.width = pct + '%';
    // under ~30% health the screen edge pulses red (and clears when healed)
    this.lowhp.classList.toggle('lit', pct < 30 && pct > 0);
  }

  /** Health-bar caption (e.g. 生命 / 装甲 while driving a tank). */
  setHealthLabel(text: string) {
    const el = document.getElementById('health-label');
    if (el) el.textContent = text;
  }

  setAmmo(mag: number, reserve: number, reloading: boolean) {
    this.ammoMag.textContent = reloading ? '··' : String(mag);
    this.ammoReserve.textContent = ' / ' + reserve;
    this.ammoMag.style.color = reloading ? '#8a917f' : '#d7e0c8';
  }

  setEnemies(n: number) {
    this.enemyCount.textContent = String(n);
  }

  /** Friendly squad count with a colour cue as members fall. */
  setSquad(alive: number, total: number) {
    this.squadCount.textContent = String(alive);
    this.squadCount.classList.toggle('low', alive > 0 && alive < total);
    this.squadCount.classList.toggle('zero', alive <= 0);
  }

  addKill(text: string) {
    const line = document.createElement('div');
    line.className = 'kill-line';
    line.innerHTML = text;
    this.killfeed.prepend(line);
    while (this.killfeed.childElementCount > 5) {
      this.killfeed.lastElementChild?.remove();
    }
    setTimeout(() => line.remove(), 4000);
  }

  clearKillfeed() {
    this.killfeed.innerHTML = '';
  }

  flashDamage() {
    this.damageFlash.style.opacity = '1';
    setTimeout(() => (this.damageFlash.style.opacity = '0'), 90);
  }

  private hintTimer = 0;
  showHint(text: string, autoHideMs = 0) {
    this.hint.innerHTML = text;
    this.hint.classList.remove('hidden');
    if (this.hintTimer) {
      clearTimeout(this.hintTimer);
      this.hintTimer = 0;
    }
    if (autoHideMs > 0) {
      this.hintTimer = window.setTimeout(() => this.hideHint(), autoHideMs);
    }
  }

  hideHint() {
    this.hint.classList.add('hidden');
  }

  // ---------- mission objective ----------

  /** Refresh (and reveal) the objective panel. Called every fixed step. */
  setObjective(view: ObjectiveView) {
    this.objective.classList.remove('hidden');
    this.objTitle.textContent = t(view.titleKey);
    this.objDesc.textContent =
      view.progress === '★' ? t('obj.exfil') : t(view.descKey);
    this.objProgress.textContent = view.progress;
    if (view.timer) {
      this.objTimer.classList.remove('hidden');
      this.objTimer.textContent = view.timer;
      this.objTimer.classList.toggle('urgent', view.urgent);
    } else {
      this.objTimer.classList.add('hidden');
    }
  }

  hideObjective() {
    this.objective.classList.add('hidden');
  }

  // ---------- game feel ----------

  /** Widen the crosshair gap (px) as recoil/movement spread the shot group. */
  setSpread(px: number) {
    this.crosshair.style.setProperty('--gap', px.toFixed(1) + 'px');
  }

  showCrosshair() {
    this.crosshair.style.display = 'block';
  }
  hideCrosshair() {
    this.crosshair.style.display = 'none';
  }

  /** Brief ✕ at screen centre; `kill` tints it hot-orange and makes it pop. */
  hitMarker(kill: boolean) {
    this.hitmarker.textContent = '✕';
    this.hitmarker.classList.toggle('kill', kill);
    this.hitmarker.style.opacity = '1';
    this.hitmarker.style.transform = `translate(-50%, -50%) scale(${kill ? 1.4 : 1.1})`;
    clearTimeout(this.hmT);
    this.hmT = window.setTimeout(() => {
      this.hitmarker.style.opacity = '0';
      this.hitmarker.style.transform = 'translate(-50%, -50%) scale(1)';
    }, kill ? 180 : 110);
  }

  /** Point a screen-edge arc at the threat. `angleRad` is bearing clockwise from forward. */
  damageDirection(angleRad: number) {
    this.dmgDir.style.transform = `translate(-50%, -50%) rotate(${angleRad}rad)`;
    this.dmgDir.classList.add('show');
    clearTimeout(this.ddT);
    this.ddT = window.setTimeout(() => this.dmgDir.classList.remove('show'), 700);
  }

  /** PvP hunt scoreboard (top centre, transient per change). */
  setPvpScore(self: number, foe: number) {
    let el = document.getElementById('pvp-score');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pvp-score';
      document.body.appendChild(el);
    }
    el.textContent = `${self} : ${foe}`;
    el.style.opacity = '1';
    clearTimeout(this.pvpScoreT);
    this.pvpScoreT = window.setTimeout(() => {
      if (el) el.style.opacity = '0.35';
    }, 2500);
  }
  private pvpScoreT = 0;

  /** Sniper scope overlay while aiming at 2x+ zoom. */
  setScope(on: boolean) {
    this.scopeEl?.classList.toggle('hidden', !on);
  }

  /** Gold "击杀" pop on a confirmed kill. Safe to retrigger mid-animation. */
  killBadge() {
    const el = this.killBadgeEl;
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add('pop');
  }

  /** Dim amber arc: an enemy fired from this bearing (didn't necessarily hit). */
  gunfireDirection(angleRad: number) {
    if (!this.fireDir) return;
    this.fireDir.style.transform = `translate(-50%, -50%) rotate(${angleRad}rad)`;
    this.fireDir.classList.add('show');
    clearTimeout(this.fdT);
    this.fdT = window.setTimeout(() => this.fireDir!.classList.remove('show'), 700);
  }
}
