// Weapon system: 4-slot arsenal, firing, hit resolution, per-weapon ammo,
// reload, recoil kick. Semi-auto weapons consume a click edge; autos hold.
import * as THREE from 'three';
import { CONFIG } from '../../../config';
import type { WeaponDef } from '../../../config';import { PhysicsWorld } from '../../../physics/world';
import { Player } from '../player/player';
import { Effects } from '../effects';
import { Audio } from '../audio/audio';
import { Enemy } from '../ai/enemy';
import { Magazine } from '../weapons/magazine';

export class Weapon {
  cur = 0;
  private mags: Magazine[] = CONFIG.weapons.map((w) => new Magazine(w.magSize, w.magSize, w.reserve));
  private cooldown = 0;
  private recoil = 0;
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
    private effects: Effects,
    private audio: Audio,
    private getEnemies: () => unknown[] // unused: hits resolve via collider userData
  ) {}

  get def(): WeaponDef {
    return CONFIG.weapons[this.cur];
  }
  get mag() {
    return this.mags[this.cur].rounds;
  }
  get reserve() {
    return this.mags[this.cur].reserve;
  }
  get reloading() {
    return this.mags[this.cur].reloading;
  }
  /** Current recoil magnitude (drives the dynamic crosshair spread). */
  get recoilLevel() {
    return this.recoil;
  }
  /** Aim-down-sights (held RMB). Narrowed spread + steadier aim. */
  ads = false;
  private static readonly ADS_SPREAD = 0.35; // multiplier while aiming
  private static readonly ADS_RECOIL = 0.7;

  /** Resupply point: top every slot's reserve back to its initial allocation. */
  refillAllReserves() {
    CONFIG.weapons.forEach((w, i) => this.mags[i].refillReserve(w.reserve));
    this.onAmmoChange?.(this.mag, this.reserve, this.reloading);
  }

  reload() {
    const d = this.def;
    const mag = this.mags[this.cur];
    mag.startReload(d.reloadTime);
    if (mag.reloading) {
      this.audio.playReload();
      this.onAmmoChange?.(this.mag, this.reserve, true);
    }
  }

  /** Switch slot (wraps). Cancels reload, brief swap cooldown. */
  switchTo(slot: number) {
    const n = CONFIG.weapons.length;
    const idx = ((slot % n) + n) % n;
    if (idx === this.cur) return;
    this.mags[this.cur].cancelReload();
    this.cur = idx;
    this.cooldown = 0.25; // swap time
    this.recoil = 0;
    this.audio.playSwitch();
    this.onSwitch?.(this.def);
    this.onAmmoChange?.(this.mag, this.reserve, false);
  }

  /** Full reset for a new operation: all mags topped, back to slot 1. */
  reset() {
    this.mags = CONFIG.weapons.map((w) => new Magazine(w.magSize, w.magSize, w.reserve));
    this.cur = 0;
    this.cooldown = 0;
    this.recoil = 0;
    this.onSwitch?.(this.def);
    this.onAmmoChange?.(this.mag, this.reserve, false);
  }

  private fire() {
    const d = this.def;
    this.mags[this.cur].consume();
    this.cooldown = 1 / d.fireRate;
    this.recoil += d.recoil * (this.ads ? Weapon.ADS_RECOIL : 1);
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
        // ignore the friendly and keep casting past them
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
        // drums take bullet damage and cook off when their HP runs out
        this.effects.spark(end);
        this.audio.playEnemyHit();
        ud.barrel.hit(d.damage);
      } else if (ud && ud.type === 'crate' && ud.rec) {
        // wooden cover chips away and shatters when its HP runs out
        this.effects.spark(end);
        const smashed = ud.rec.hit(d.damage);
        if (smashed) this.audio.playWoodCrack();
        else this.audio.playHit();
      } else if (ud && ud.type === 'jeep' && ud.jeep) {
        // unarmoured: bullets chew the jeep up at full damage
        this.effects.spark(end);
        this.audio.playArmorClank();
        ud.jeep.damage(d.damage);
      } else if (ud && ud.type === 'tank' && ud.tank) {
        // small arms can't penetrate armour — spark + clank, micro damage only
        this.effects.spark(end);
        this.audio.playArmorClank();
        ud.tank.damage(d.damage * CONFIG.tank.bulletArmor);
      } else {
        // hit world/obstacle — spark, a puff of dirt, and a lasting bullet hole
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
    if (this.cooldown > 0) this.cooldown -= dt;

    const mag = this.mags[this.cur];
    if (mag.reloading) {
      const wasReloading = mag.reloading;
      mag.tick(dt);
      if (wasReloading && !mag.reloading) {
        this.onAmmoChange?.(this.mag, this.reserve, false);
      }
    } else {
      const trigger = this.def.auto ? fireDown : fireClicked;
      if (trigger && this.cooldown <= 0) {
        if (this.mag <= 0) {
          // empty: auto-reload if there's any reserve (FPS standard). The old
          // behaviour clicked forever while the trigger stayed held — that
          // read as "gunfire keeps going after I stopped".
          if (this.reserve > 0) {
            this.reload();
          } else {
            this.audio.playEmpty();
            this.cooldown = 0.5;
          }
        } else {
          this.fire();
        }
      }
    }

    // recoil kick (cosmetic, applied after player.update set the camera)
    if (this.recoil > 0) {
      camera.rotation.x += this.recoil;
      this.recoil = Math.max(0, this.recoil - dt * 0.12);
    }
  }
}
