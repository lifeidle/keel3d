/**
 * Mission objective, kill feed, win/lose settlement.
 * A7: mission side of updateHudAndMission + checkStreak.
 * Net/PvP ticks stay on Game until A11.
 */
import { t } from '../../../i18n';
import type { System, EngineWorld } from '../../../engine/types';
import { opScale } from '../../../world/scale';
import type { Game } from '../game';

export class MissionSystem implements System {
  readonly name = 'nightraid.mission';
  private lastAlive = 0;
  private lastSquadAlive = 0;
  private streakPlayed = 0;
  private losingVoiced = false;

  constructor(private game: Game) {}

  fixedUpdate(dt: number, world: EngineWorld): void {
    if (!world.playing) return;
    const m = this.game.missionFrame;
    // PvP / client paths are owned by Game net ticks (A11) — skip here.
    if (m.pvpActive || m.isClient) {
      // client still paints counters from ghosts (kept on Game for now)
      if (m.isClient && m.ghostSwarm) {
        const ghostN = m.ghostSwarm.enemyAliveCount();
        m.hud.setEnemies(ghostN);
        m.hud.setSquad(m.ghostSwarm.allyAliveCount(), opScale().allies);
        m.hud.setObjective(m.mission.view(ghostN, opScale().enemies));
      }
      return;
    }

    // seed counters on first tick after a match starts
    if (this.lastAlive === 0) {
      this.lastAlive = m.alive;
      this.lastSquadAlive = m.squadAlive;
    }

    // kill-feed delta (hostiles only)
    if (m.alive < this.lastAlive) {
      const killed = this.lastAlive - m.alive;
      m.noteKills(killed);
      m.hud.addKill(`<b>${killed}</b> ${t('kill.down')}`);
      this.lastAlive = m.alive;
      this.checkStreak(m);
    }
    m.hud.setEnemies(m.alive);

    // friendly squad status
    const sqAlive = m.squadAlive;
    const sqTotal = opScale().allies;
    if (sqAlive < this.lastSquadAlive) {
      const lost = this.lastSquadAlive - sqAlive;
      m.hud.addKill(`<b>${lost}</b> ${t('hud.allyDown')}`);
      if (sqAlive === 0 && !this.losingVoiced && sqTotal > 0) {
        this.losingVoiced = true;
        m.audio.playVoice('v_losing', 0.8);
      }
    }
    if (sqAlive > this.lastSquadAlive) this.losingVoiced = false;
    this.lastSquadAlive = sqAlive;
    m.hud.setSquad(sqAlive, sqTotal);

    // mission objective / win-lose
    const res = m.mission.update(dt, m.playerPos, m.alive, opScale().enemies);
    m.hud.setObjective(m.mission.view(m.alive, opScale().enemies));
    if (res === 'win') m.gameOver(true);
    else if (res === 'lose') {
      m.markTimedOut();
      m.gameOver(false);
    }
  }

  /** Reset counters when a new match starts (called from Game.beginPlaying). */
  reset(): void {
    this.lastAlive = 0;
    this.lastSquadAlive = 0;
    this.streakPlayed = 0;
    this.losingVoiced = false;
  }

  private checkStreak(m: Game['missionFrame']): void {
    const nodes: Array<[number, string, string]> = [
      [3, 'v_streak3', 'streak.3'],
      [5, 'v_streak5', 'streak.5'],
      [8, 'v_streak8', 'streak.8'],
    ];
    for (const [n, voice, key] of nodes) {
      if (m.kills === n && this.streakPlayed < n) {
        this.streakPlayed = n;
        m.hud.addKill(`<b>${t(key)}</b>`);
        m.audio.playVoice(voice, 0.9);
        return;
      }
    }
  }
}
