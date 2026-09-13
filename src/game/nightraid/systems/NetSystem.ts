/**
 * Netplay sync: host snapshots, client input, PvP hunt ticks, event router.
 * A11: extracted from updateHudAndMission + onNetEvent.
 */
import * as THREE from 'three';
import { CONFIG } from '../../../config';
import { t } from '../../../i18n';
import type { System, EngineWorld } from '../../../engine/types';
import {
  SnapshotEnemy,
  SnapshotAlly,
  encodeSnapshot,
  NET_EVENTS,
  BTN,
} from '../../../net/protocol';
import type { Game } from '../game';

export class NetSystem implements System {
  readonly name = 'nightraid.net';
  private netSnapT = 0;
  private netInputT = 0;
  private snapTick = 0;
  private pvpTimeLeft = 600;
  pvpRespawnT = 0;

  constructor(private game: Game) {}

  reset(): void {
    this.netSnapT = 0;
    this.netInputT = 0;
    this.snapTick = 0;
    this.pvpTimeLeft = 600;
    this.pvpRespawnT = 0;
  }

  fixedUpdate(dt: number, world: EngineWorld): void {
    if (!world.playing) return;
    const n = this.game.netFrame;

    // --- host: remote ghost + 20Hz world snapshot ---
    if (n.netMode === 'host' && n.net.state === 'ready' && n.remotePlayer) {
      n.remotePlayer.update(dt, n.terrain);
      n.enemies.setRemoteTarget(n.remotePlayer);
      this.netSnapT += dt;
      if (this.netSnapT >= 0.05) {
        this.netSnapT = 0;
        const enemies: SnapshotEnemy[] = [];
        n.enemies.getEnemies().forEach((e, i) => {
          if (!e.alive) return;
          const ep = e.pos();
          const hp = Math.max(0, Math.round((e as unknown as { health: number }).health));
          enemies.push({ id: i, x: ep.x, z: ep.z, yaw: 0, hp, flags: 0 });
        });
        const allies: SnapshotAlly[] = n.enemies.getAlliesSnapshot();
        const w = window as unknown as Record<string, number>;
        w.__sfSent = (w.__sfSent ?? 0) + 1;
        n.net.sendSnapshot(
          encodeSnapshot(
            this.snapTick++ & 0xffff,
            n.player.health,
            n.player.pos.x,
            n.player.pos.y,
            n.player.pos.z,
            enemies,
            allies,
          ),
        );
      }
    }

    // --- PvP hunt tick ---
    const pvpActive = n.netPvp && n.net.state === 'ready';
    if (pvpActive) {
      this.pvpTimeLeft -= dt;
      if (this.pvpTimeLeft <= 0) {
        n.gameOver(n.pvpScoreSelf >= n.pvpScoreFoe);
      }
      if (n.pvpRespawnT > 0) {
        n.pvpRespawnT -= dt;
        if (n.pvpRespawnT <= 0) {
          const sp =
            n.allySpawns[(Math.random() * n.allySpawns.length) | 0] ??
            new THREE.Vector3(n.base.x, 0.1, n.base.z);
          n.player.respawnAt(sp.x, sp.z);
          n.hud.setHealth(n.player.health, CONFIG.player.maxHealth);
          if (n.netMode === 'host') {
            n.net.sendEvent(NET_EVENTS.RESPAWN, new Uint8Array([1]).buffer);
          }
        }
      }
      if (n.pvpScoreSelf >= 15) n.gameOver(true);
      else if (n.pvpScoreFoe >= 15) n.gameOver(false);
    }

    // --- client: 30Hz input + ghost swarm ---
    if (n.netMode === 'client' && n.net.state === 'ready') {
      this.netInputT += dt;
      if (this.netInputT >= 0.033) {
        this.netInputT = 0;
        const ax = n.input.moveAxis();
        const btn =
          (n.input.fireDown ? BTN.FIRE : 0) |
          (n.input.adsToggle ? BTN.ADS : 0) |
          (n.input.crouchHeld ? BTN.CROUCH : 0) |
          (n.input.consumeProneToggle() ? BTN.PRONE : 0);
        n.net.sendInput(btn, n.player.yaw, n.player.pitch, ax.x, ax.z);
      }
      n.ghostSwarm?.update(dt);
      const pp = n.player.pos;
      const canRescue = n.ghostSwarm?.downedAllyNear(pp.x, pp.z, 2.6) ?? false;
      const canSupply = n.ammoDumps.some(
        (d) => Math.hypot(d.x - pp.x, d.z - pp.z) < 3,
      );
      const hint = canRescue ? t('rescue.hint') : canSupply ? t('resupply.hint') : null;
      if (hint && !n.dumpHintOn) {
        n.setDumpHint(true);
        n.hud.showHint(hint, 1.2);
      } else if (!hint && n.dumpHintOn) {
        n.setDumpHint(false);
        n.hud.hideHint();
      }
    }
  }

  /** Netplay event router: host settles client requests; client renders host truth. */
  handleEvent(sub: number, args: DataView): void {
    const n = this.game.netFrame;
    if (n.netMode === 'host') {
      if (sub === NET_EVENTS.RESPAWN && n.remotePlayer) {
        n.remotePlayer.hp = 100;
        return;
      }
      if (sub === NET_EVENTS.HIT && args.byteLength >= 2 && args.getUint8(0) === 1) {
        n.damagePlayer(args.getUint8(1));
        return;
      }
      if (sub === NET_EVENTS.INTERACT) {
        const kind = args.getUint8(0);
        const rp = n.remotePlayer;
        if (!rp) return;
        const rpPos = rp.pos();
        if (kind === 0) {
          const downed = n.enemies.nearestDowned(rpPos.x, rpPos.z, 2.6);
          if (downed) {
            downed.revive();
            n.net.sendEvent(NET_EVENTS.RESC, new ArrayBuffer(0));
            n.hud.addKill(`<b>${t('rescue.done')}</b>`);
          }
        } else if (kind === 1) {
          const dump = n.ammoDumps.findIndex(
            (d, i) =>
              !n.resupplied.has(i) && Math.hypot(d.x - rpPos.x, d.z - rpPos.z) < 3,
          );
          if (dump >= 0) {
            n.markResupplied(dump);
            n.net.sendEvent(NET_EVENTS.MEDKIT, new ArrayBuffer(1));
          }
        }
      }
      return;
    }
    // CLIENT: render the host's truth
    if (sub === NET_EVENTS.SHOT) {
      const mx = args.getFloat32(0);
      const my = args.getFloat32(4);
      const mz = args.getFloat32(8);
      const dx = args.getFloat32(12);
      const dy = args.getFloat32(16);
      const dz = args.getFloat32(20);
      const muzzle = new THREE.Vector3(mx, my, mz);
      const end = muzzle
        .clone()
        .addScaledVector(new THREE.Vector3(dx, dy, dz).normalize(), 60);
      n.effects.tracer(muzzle, end);
      n.effects.muzzle(muzzle);
      n.audio.playJeepMG();
    } else if (sub === NET_EVENTS.HIT) {
      if (args.getUint8(0) === 0) {
        const dmg = args.getUint8(1);
        if (dmg > 0) {
          n.player.damage(dmg);
          n.hud.setHealth(n.player.health, CONFIG.player.maxHealth);
          n.hud.flashDamage();
          if (n.player.health <= 0 && n.netPvp) {
            n.pvpRespawnT = 3;
          }
        }
      }
    } else if (sub === NET_EVENTS.SCORE) {
      n.hud.setPvpScore(args.getUint8(1), args.getUint8(0));
    } else if (sub === NET_EVENTS.RESC) {
      n.hud.showHint(t('rescue.done'), 2.5);
    } else if (sub === NET_EVENTS.MISSION) {
      n.gameOver(args.getUint8(0) === 1);
    } else if (sub === NET_EVENTS.MEDKIT) {
      n.weapon.refillAllReserves();
      n.hud.showHint(t('resupply.done'), 2.5);
    } else if (sub === NET_EVENTS.RESPAWN) {
      // host respawned — ghost hp resets via the next snapshot
    }
  }
}
