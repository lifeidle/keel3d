// Explosible fuel drums: static props with HP that cook off into a radial
// blast ???damages player AND enemies, nudges rigid bodies, and chain-detonates
// neighbours through a short randomized fuse. Only the player's bullets damage
// them (enemy fire is hitscan-to-player only), which keeps them a player tool.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { CONFIG } from '../../../config';
import { PhysicsWorld } from '../../../physics/world';
import { Effects } from '../effects';
import { Audio } from '../audio/audio';
import { scorchTexture } from '../../../world/textures';
import { upgrade } from '../world/phototex';
import type { Enemy } from '../ai/enemy';
import type { GeneratedMap } from '../../../world/mapgen';
import { blastFalloff } from '../../../world/ballistics';

export interface BarrelHooks {
  playerEye: () => THREE.Vector3;
  damagePlayer: (d: number, source?: THREE.Vector3) => void;
  /** Enemies killed by one blast (for the kill feed). */
  onKill: (n: number) => void;
  /** Any detonation (drives music heat). */
  onBoom: () => void;
  /** Blast a point to let tanks etc. take radial damage too (HE vs armour). */
  onBlast: (p: THREE.Vector3, dmg: number, radius: number) => void;
}

interface BarrelRec {
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  pos: THREE.Vector3;
  hp: number;
  alive: boolean;
  fuse: number; // >=0: lit and counting down; -1: dormant
  flash: number; // hit-flash 0..1 (also the fuse blink)
  removed: boolean;
  /** Bound to the owning BarrelManager (bullet/shell hit path). */
  hit: (dmg: number) => void;
}

const EMISSIVE_BASE = 0.35; // keeps drums readable in the dark

export class BarrelManager {
  private group = new THREE.Group();
  private list: BarrelRec[] = [];

  constructor(
    private physics: PhysicsWorld,
    private scene: THREE.Scene,
    private effects: Effects,
    private audio: Audio,
    private getEnemies: () => Enemy[],
    private hooks: BarrelHooks
  ) {
    this.scene.add(this.group);
  }

  /** Wipe existing barrels (and scorch marks) and populate the fresh map. */
  reset(map: GeneratedMap) {
    this.clear();
    this.spawn(map);
  }

  // ---------- population ----------

  private spawn(map: GeneratedMap) {
    const B = CONFIG.barrel;
    const half = CONFIG.map.contentHalf;
    const placed: Array<{ x: number; z: number }> = [];
    let tries = 0;
    while (placed.length < B.count && tries < 220) {
      tries++;
      const x = (Math.random() * 2 - 1) * (half - 5);
      const z = (Math.random() * 2 - 1) * (half - 5);
      if (Math.hypot(x - map.base.x, z - map.base.z) < CONFIG.map.spawnClear + 1) continue; // player base
      if (
        map.obstacles.some(
          (b) => Math.abs(x - b.x) < b.hx + 1.2 && Math.abs(z - b.z) < b.hz + 1.2
        )
      )
        continue; // not inside cover
      if (map.spawnPoints.some((p) => Math.hypot(x - p.x, z - p.z) < 2.5)) continue;
      if (placed.some((p) => Math.hypot(x - p.x, z - p.z) < 6)) continue;
      placed.push({ x, z });
      // drums rest on the terrain surface, wherever that happens to be
      this.makeBarrel(x, z, map.terrain.heightAt(x, z));
    }
  }

  private makeBarrel(x: number, z: number, gy: number) {
    const B = CONFIG.barrel;
    const mesh = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x8a3324,
      roughness: 0.55,
      metalness: 0.35,
      emissive: 0xff5a22,
      emissiveIntensity: EMISSIVE_BASE,
    });
    // rusty steel photo set (cylinders get UVs by default) ???async swap-in
    upgrade(bodyMat, 'rusty_metal', 1, 0.8);
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.4,
      metalness: 0.65,
    });
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(B.radius, B.radius, B.height, 14),
      bodyMat
    );
    drum.position.y = B.height / 2;
    drum.castShadow = true;
    drum.receiveShadow = true;
    mesh.add(drum);
    for (const yy of [B.height * 0.25, B.height * 0.75]) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(B.radius + 0.015, B.radius + 0.015, 0.06, 14),
        bandMat
      );
      band.position.y = yy;
      band.castShadow = true;
      mesh.add(band);
    }
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(B.radius * 0.96, B.radius * 0.96, 0.04, 14),
      new THREE.MeshStandardMaterial({ color: 0x3d2b20, roughness: 0.7, metalness: 0.3 })
    );
    cap.position.y = B.height + 0.02;
    mesh.add(cap);
    mesh.position.set(x, gy, z);
    this.group.add(mesh);

    // record first (body/collider slots backfilled), so the fixed body's
    // userData can reference it for raycast resolution
    const rec: BarrelRec = {
      mesh,
      body: null as unknown as RAPIER.RigidBody,
      collider: null as unknown as RAPIER.Collider,
      pos: new THREE.Vector3(x, gy, z),
      hp: B.hp,
      alive: true,
      fuse: -1,
      flash: 0,
      removed: false,
      // late-bound closure: weapons/shells call `ud.barrel.hit(dmg)` directly
      // on the record; this forwards into the manager's real damage path.
      hit: (dmg: number) => this.hit(rec, dmg),
    };
    const body = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(x, gy + B.height / 2, z)
        .setUserData({ type: 'barrel', barrel: rec })
    );
    rec.body = body;
    rec.collider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(B.radius * 0.85, B.height / 2, B.radius * 0.85)
        .setFriction(0.7)
        .setRestitution(0.1),
      body
    );
    this.list.push(rec);
  }

  // ---------- combat ----------

  /** Bullet damage from the weapon system. */
  hit(rec: BarrelRec, dmg: number) {
    if (!rec.alive) return;
    rec.hp -= dmg;
    rec.flash = 1;
    if (rec.hp <= 0) this.detonate(rec);
  }

  private detonate(rec: BarrelRec) {
    if (!rec.alive) return;
    rec.alive = false;
    rec.fuse = -1;
    const B = CONFIG.barrel;
    const p = rec.pos.clone();
    p.y = rec.pos.y + B.height * 0.55;

    this.effects.explosion(p);
    this.audio.playExplosion();
    this.hooks.onBoom();
    this.hooks.onBlast(p, B.blastDamage, B.blastRadius);

    // visuals + physics gone; leave a scorched decal behind (irregular char)
    this.group.remove(rec.mesh);
    rec.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = (m as unknown as { material?: THREE.Material }).material;
      mat?.dispose?.();
    });
    this.removeBody(rec);
    for (let d = 0; d < 2; d++) {
      const sr = 1.2 + Math.random() * 0.9;
      const scorch = new THREE.Mesh(
        new THREE.CircleGeometry(sr, 20),
        new THREE.MeshBasicMaterial({
          map: scorchTexture(),
          color: 0xffffff,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        })
      );
      scorch.rotation.x = -Math.PI / 2;
      scorch.rotation.z = Math.random() * Math.PI;
      scorch.position.set(
        rec.pos.x + (Math.random() - 0.5) * 0.5,
        rec.pos.y + 0.03 + d * 0.01,
        rec.pos.z + (Math.random() - 0.5) * 0.5
      );
      this.group.add(scorch);
    }

    // radial damage + knockback on enemies (linear falloff to the edge)
    let kills = 0;
    for (const e of this.getEnemies()) {
      if (!e.alive) continue;
      const t3 = e.body.translation();
      const d = Math.hypot(t3.x - p.x, t3.y - p.y, t3.z - p.z);
      if (d > B.blastRadius) continue;
      const f = blastFalloff(d, B.blastRadius, B.edgeFrac);
      const dir = new THREE.Vector3(t3.x - p.x, 0.7, t3.z - p.z).normalize();
      e.damage(B.blastDamage * f, new THREE.Vector3(t3.x, t3.y, t3.z), dir);
      try {
        e.body.applyImpulse(
          { x: dir.x * B.impulse * f, y: 2.2 * f, z: dir.z * B.impulse * f },
          true
        );
      } catch {
        /* body may be mid-teardown */
      }
      if (!e.alive) kills++;
    }
    if (kills > 0) this.hooks.onKill(kills);

    // the player is not immune (kinematic ???no knockback, just hurt)
    const eye = this.hooks.playerEye();
    const pd = Math.hypot(eye.x - p.x, eye.y - p.y, eye.z - p.z);
    if (pd < B.blastRadius) {
      const f = blastFalloff(pd, B.blastRadius, B.edgeFrac);
      this.hooks.damagePlayer(Math.round(B.blastDamage * f * 0.8));
    }

    // light neighbouring drums with a short staggered fuse
    for (const other of this.list) {
      if (other === rec || !other.alive || other.fuse >= 0) continue;
      const d = Math.hypot(other.pos.x - rec.pos.x, other.pos.z - rec.pos.z);
      if (d < B.blastRadius * 0.75) {
        other.fuse = B.fuseMin + Math.random() * (B.fuseMax - B.fuseMin);
      }
    }
  }

  private removeBody(rec: BarrelRec) {
    if (rec.removed) return;
    rec.removed = true;
    try {
      this.physics.world.removeRigidBody(rec.body);
    } catch {
      /* already gone */
    }
  }

  // ---------- per-step tick ----------

  /** Minimap blips: alive drum positions. */
  getBlips(): Array<{ x: number; z: number }> {
    return this.list.filter((r) => r.alive).map((r) => ({ x: r.pos.x, z: r.pos.z }));
  }

  /** Fuse countdowns + hit-flash decay. Runs once per fixed physics step. */
  update(dt: number) {
    for (const rec of this.list) {
      if (!rec.alive) continue;
      if (rec.fuse >= 0) {
        rec.fuse -= dt;
        // blink accelerates as the fuse burns down
        rec.flash = 0.6 + 0.4 * Math.sin(Math.max(0, rec.fuse) * 40);
        if (rec.fuse <= 0) {
          this.detonate(rec);
          continue; // mesh removed; nothing left to tint this pass
        }
      } else if (rec.flash > 0) {
        rec.flash = Math.max(0, rec.flash - dt * 3.5);
      }
      const drum = rec.mesh.children[0] as THREE.Mesh;
      (drum.material as THREE.MeshStandardMaterial).emissiveIntensity =
        EMISSIVE_BASE + rec.flash * 1.2;
    }
  }

  // ---------- teardown ----------

  private clear() {
    for (const rec of this.list) {
      if (!rec.removed) this.removeBody(rec);
    }
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = (m as unknown as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.group.clear();
    this.list = [];
  }
}
