// Weapon system: hitscan + hit resolution + effects/audio.
// Slot/mag/cooldown/recoil bookkeeping lives in blocks/combat/Arsenal.
import * as THREE from 'three';
import { CONFIG } from '../../../config';
import type { WeaponDef } from '../../../config';
import { PhysicsWorld } from '../../../physics/world';
import { Player } from '../player/player';
import { CombatVfx } from '../../../blocks/fx/CombatVfx';
import { Audio } from '../audio/audio';
import { Arsenal } from '../../../blocks/combat/Arsenal';

export class Weapon {
  private arsenal = new Arsenal(
    CONFIG.weapons.map((w) => ({
      key: w.key,
      magSize: w.magSize,
      reserve: w.reserve,
      reloadTime: w.reloadTime,
      fireRate: w.fireRate,
      auto: w.auto,
    })),
  );
  onAmmoChange: ((mag: number, reserve: number, reloading: boolean) => void) | null = null;
  onFire: (() => void) | null = null;
  onSwitch: ((def: WeaponDef) => void) | null = null;
  /** Fired when a bullet connects with an enemy; `kill` true if it dropped them. */
  onHit: ((kill: boolean) => void) | null = null;
  /** World position of the active viewmodel's muzzle marker (fallback: eye + dir). */
  getMuzzleWorld: (() => THREE.Vector3 | null) | null = null;

  constructor(
    private physics: PhysicsWorld,
    private player: Player,
    private effects: CombatVfx,
    private audio: Audio,
    private getEnemies: () => unknown[] // unused: hits resolve via collider userData
  ) {}

  get cur(): number {
    return this.arsenal.index;
  }
  get def(): WeaponDef {
    return CONFIG.weapons[this.arsenal.index];
  }
  get mag(): number {
    return this.arsenal.mag;
  }
  get reserve(): number {
    return this.arsenal.reserve;
  }
  get reloading(): boolean {
    return this.arsenal.reloading;
  }
  /** Current recoil magnitude (drives the dynamic crosshair spread). */
  get recoilLevel(): number {
    return this.arsenal.recoil;
  }
  /** Aim-down-sights (held RMB). Narrowed spread + steadier aim. */
  ads = false;
  private static readonly ADS_SPREAD = 0.35; // multiplier while aiming
  private static readonly ADS_RECOIL = 0.7;

  /** Resupply point: top every slot's reserve back to its initial allocation. */
  refillAllReserves() {
    this.arsenal.refillAll();
    this.onAmmoChange?.(this.mag, this.reserve, this.reloading);
  }

  reload() {
    if (this.arsenal.reload()) {
      this.audio.playReload();
      this.onAmmoChange?.(this.mag, this.reserve, true);
    }
  }

  /** Switch slot (wraps). Cancels reload, brief swap cooldown. */
  switchTo(slot: number) {
    if (!this.arsenal.switchTo(slot)) return;
    this.audio.playSwitch();
    this.onSwitch?.(this.def);
    this.onAmmoChange?.(this.mag, this.reserve, false);
  }

  /** Full reset for a new operation: all mags topped, back to slot 1. */
  reset() {
    this.arsenal.reset();
    this.onSwitch?.(this.def);
    this.onAmmoChange?.(this.mag, this.reserve, false);
  }

  /** Hitscan + effects; ammo already consumed by Arsenal.update. */
  private fire() {
    const d = this.def;
    this.arsenal.addRecoil(d.recoil * (this.ads ? Weapon.ADS_RECOIL : 1));
    this.audio.playWeaponShot(d.sound);

    const eye = this.player.getEye();
    const dir = this.aimDir(d.spread * (this.ads ? Weapon.ADS_SPREAD : 1));
    const mzWorld = this.getMuzzleWorld?.() ?? null;
    const muzzle = mzWorld ?? eye.clone().addScaledVector(dir, 0.6);

    this.effects.muzzle(muzzle);

    // hitscan with friendly-fire skip: bullets pass through squad members
    let hit = this.physics.raycast(
      { x: eye.x, y: eye.y, z: eye.z },
      { x: dir.x, y: dir.y, z: dir.z },
      d.range,
      this.player.collider
    );
    let skipped = 0;
    while (hit && skipped < 4) {
      const body = hit.collider.parent();
      const ud = body?.userData as any;
      if (ud?.type === 'ally') {
        hit = this.physics.raycast(
          { x: eye.x, y: eye.y, z: eye.z },
          { x: dir.x, y: dir.y, z: dir.z },
          d.range,
          hit.collider
        );
        skipped++;
        continue;
      }
      break;
    }

    if (hit) {
      const end = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
      this.effects.tracer(muzzle, end);
      const body = hit.collider.parent();
      const ud = body?.userData as any;
      if (ud && ud.type === 'enemy' && ud.soldier) {
        this.effects.spark(end);
        const wasAlive = ud.soldier.alive;
        ud.soldier.damage(d.damage, end, dir);
        const killed = wasAlive && !ud.soldier.alive;
        this.audio.playHit();
        if (killed) this.audio.playKillConfirm();
        this.onHit?.(killed);
      } else if (ud && ud.type === 'barrel' && ud.barrel) {
        this.effects.spark(end);
        this.audio.playEnemyHit();
        ud.barrel.hit(d.damage);
      } else if (ud && ud.type === 'crate' && ud.rec) {
        this.effects.spark(end);
        const smashed = ud.rec.hit(d.damage);
        if (smashed) this.audio.playWoodCrack();
        else this.audio.playHit();
      } else if (ud && ud.type === 'wheeled' && ud.wheeled) {
        this.effects.spark(end);
        this.audio.playArmorClank();
        ud.wheeled.damage(d.damage);
      } else if (ud && ud.type === 'tracked' && ud.tracked) {
        this.effects.spark(end);
        this.audio.playArmorClank();
        ud.tracked.damage(d.damage * CONFIG.tank.bulletArmor);
      } else {
        this.effects.spark(end);
        this.effects.dust(end);
        this.effects.decal(
          end,
          new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z)
        );
      }
    } else {
      const end = eye.clone().addScaledVector(dir, d.range);
      this.effects.tracer(muzzle, end);
    }

    this.onAmmoChange?.(this.mag, this.reserve, this.reloading);
    this.onFire?.();
  }

  /** Aim direction from yaw/pitch plus random spread. */
  private aimDir(spread: number, out = new THREE.Vector3()): THREE.Vector3 {
    const yaw = this.player.yaw;
    const pitch = this.player.pitch;
    out.set(
      -Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch),
      -Math.cos(pitch) * Math.cos(yaw)
    );
    out.x += (Math.random() - 0.5) * spread * 2;
    out.y += (Math.random() - 0.5) * spread * 2;
    out.z += (Math.random() - 0.5) * spread * 2;
    return out.normalize();
  }

  update(dt: number, fireDown: boolean, fireClicked: boolean, camera: THREE.PerspectiveCamera) {
    const wasReloading = this.arsenal.reloading;
    const outcome = this.arsenal.update(dt, fireDown, fireClicked);

    if (outcome === 'fired') {
      this.fire();
    } else if (outcome === 'empty' && this.arsenal.reloading && !wasReloading) {
      // auto-reload just started — notify HUD + play SFX
      this.audio.playReload();
      this.onAmmoChange?.(this.mag, this.reserve, true);
    } else if (outcome === 'empty' && !this.arsenal.reloading) {
      // dry — no reserve left
      this.audio.playEmpty();
      this.onAmmoChange?.(this.mag, this.reserve, false);
    } else if (wasReloading && !this.arsenal.reloading) {
      this.onAmmoChange?.(this.mag, this.reserve, false);
    }

    // recoil kick (cosmetic, applied after player.update set the camera)
    if (this.arsenal.recoil > 0) {
      camera.rotation.x += this.arsenal.recoil;
      this.arsenal.decayRecoil(dt, 0.12);
    }
  }
}
