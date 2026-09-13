// Network ghosts: lightweight soldier representations driven purely by the
// network. Two flavours:
//  - HOST: a remote PLAYER ghost with a kinematic body + CombatTarget so the
//    local AI can see, chase and shoot the joined player (hurt ???HIT event
//    back to the owner).
//  - CLIENT: enemy ghosts (colored capsules) interpolated from snapshots ???
//    the client never simulates AI, it only renders what the host authorizes.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import type { CombatTarget } from '../game/nightraid/ai/enemy';

function soldierMesh(color: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8), mat);
  body.position.y = 0.85;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), mat);
  head.position.y = 1.5;
  head.castShadow = true;
  g.add(body, head);
  g.scale.setScalar(scale);
  return g;
}

/** HOST side: the joined player's avatar ???physics body + CombatTarget. */
export class RemotePlayer implements CombatTarget {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Group;
  alive = true;
  downed = false;
  private targetX = 0;
  private targetZ = 0;
  hp = 100;
  private maxHp = 100;

  constructor(
    private physics: PhysicsLike,
    private scene: THREE.Scene,
    private terrain: { heightAt(x: number, z: number): number },
    x: number,
    z: number,
    /** Called when local AI/blast hurts this ghost ???forwards to the owner. */
    private onHurt: (dmg: number, from: THREE.Vector3) => void
  ) {
    const gy = terrain.heightAt(x, z);
    const half = (1.7 * 0.9) / 2 - 0.32;
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, gy + half + 0.32, z)
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(half, 0.32).setFriction(0),
      this.body
    );
    this.body.userData = { type: 'netplayer', netplayer: this };
    this.mesh = soldierMesh(0x6fd06f);
    this.mesh.position.set(x, gy, z);
    scene.add(this.mesh);
    this.targetX = x;
    this.targetZ = z;
  }

  pos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  eye(out = new THREE.Vector3()): THREE.Vector3 {
    const t = this.body.translation();
    return out.set(t.x, t.y + 0.55, t.z);
  }

  /** Latest client input (host stores it; update() moves by it). */
  driveInput(yaw: number, mx: number, mz: number) {
    this.inYaw = yaw;
    this.inMx = mx;
    this.inMz = mz;
  }

  private inYaw = 0;
  private inMx = 0;
  private inMz = 0;

  /** Input-driven: the host simulates the client's movement from INPUT frames. */
  update(dt: number, terrain: { heightAt(x: number, z: number): number }) {
    const t = this.body.translation();
    const speed = 6.5; // CONFIG.player.moveSpeed (ghost has no sprint/pose yet)
    const fx = -Math.sin(this.inYaw);
    const fz = -Math.cos(this.inYaw);
    const rx = -fz;
    const rz = fx;
    let mx = fx * this.inMz + rx * this.inMx;
    let mz = fz * this.inMz + rz * this.inMx;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const nx = t.x + mx * speed * dt;
    const nz = t.z + mz * speed * dt;
    const gy = terrain.heightAt(nx, nz);
    this.body.setNextKinematicTranslation({ x: nx, y: gy + 1.0, z: nz });
    this.mesh.position.set(nx, gy, nz);
    this.mesh.rotation.y = this.inYaw;
  }

  /** CombatTarget: local AI damage forwards over the network. */
  hurt(d: number, point: THREE.Vector3, _dir: THREE.Vector3): boolean {
    this.hp = Math.max(0, this.hp - d);
    this.onHurt(d, point);
    return this.hp <= 0;
  }

  dispose(scene: THREE.Scene, physics: PhysicsLike) {
    scene.remove(this.mesh);
    physics.world.removeRigidBody(this.body);
  }
}

interface PhysicsLike {
  world: {
    createRigidBody(d: unknown): RAPIER.RigidBody;
    createCollider(d: unknown, body: RAPIER.RigidBody): RAPIER.Collider;
    removeRigidBody(b: RAPIER.RigidBody): void;
  };
}

/** CLIENT side: enemy/ally capsules interpolated from snapshots.
 *  Enemy ghosts carry kinematic colliders so the local weapon raycasts can
 *  HIT them; hits become CLAIM events the host verifies and settles. */
export class GhostSwarm {
  private ghosts = new Map<number, GhostEnemy>();
  private allies = new Map<number, { mesh: THREE.Group; x: number; z: number; downed: boolean }>();
  private group = new THREE.Group();
  private allyGhost: AllyGhost | null = null;
  /** Wire by the game: forward a claimed hit to the host for verification. */
  onClaim: ((enemyId: number, dmg: number, point: THREE.Vector3) => void) | null = null;

  constructor(
    readonly physics: PhysicsLike,
    readonly scene: THREE.Scene,
    private terrain: { heightAt(x: number, z: number): number }
  ) {
    scene.add(this.group);
  }

  /** Rescue targeting: is a DOWNED AI ally (from the snapshot) within radius? */
  downedAllyNear(x: number, z: number, radius: number): boolean {
    for (const [, gh] of this.allies) {
      if (gh.downed && Math.hypot(gh.x - x, gh.z - z) < radius) return true;
    }
    return false;
  }

  /** Apply the snapshot's ally list: green capsules, yellow when downed. */
  applyAllies(list: Array<{ id: number; x: number; z: number; hp: number; flags: number }>) {
    const seen = new Set<number>();
    for (const a of list) {
      seen.add(a.id);
      let gh = this.allies.get(a.id);
      if (!gh) {
        const mesh = soldierMesh(0x6fd06f);
        this.group.add(mesh);
        gh = { mesh, x: a.x, z: a.z, downed: false };
        this.allies.set(a.id, gh);
      }
      gh.x = a.x;
      gh.z = a.z;
      gh.downed = (a.flags & 1) === 1;
      gh.mesh.position.set(a.x, this.tyFor(a.z) - (gh.downed ? 0.55 : 0), a.z);
      gh.mesh.rotation.x = gh.downed ? (-Math.PI / 2) * 0.88 : 0;
    }
    for (const [id, gh] of [...this.allies]) {
      if (!seen.has(id)) {
        this.group.remove(gh.mesh);
        this.allies.delete(id);
      }
    }
  }

  private tyFor(_z: number) {
    return 0; // ally ghosts sit on their snapshot xz; y comes from the mesh base
  }

  /** Apply one snapshot's enemy list (id-stable). */
  apply(list: Array<{ id: number; x: number; z: number; hp: number; flags: number }>) {
    const seen = new Set<number>();
    for (const e of list) {
      seen.add(e.id);
      let gh = this.ghosts.get(e.id);
      if (!gh) {
        gh = new GhostEnemy(this.physics, this.scene, this.terrain, this, e.id, e.x, e.z);
        this.ghosts.set(e.id, gh);
      }
      gh.applySnapshot(e.x, e.z, e.hp);
    }
    // remove ghosts that vanished from the snapshot (dead hostiles)
    for (const [id, gh] of [...this.ghosts]) {
      if (!seen.has(id)) {
        gh.dispose();
        this.ghosts.delete(id);
      }
    }
  }

  /** Weapon targeting: ghost ghosts participate in local raycast hits. */
  combatTargets(): GhostEnemy[] {
    return [...this.ghosts.values()];
  }

  /** CLIENT HUD: living hostile ghosts (snapshot-driven, id-stable). */
  enemyAliveCount(): number {
    let n = 0;
    for (const [, gh] of this.ghosts) if (gh.alive) n++;
    return n;
  }

  /** CLIENT HUD: standing squad ghosts (downed ones read as lost). */
  allyAliveCount(): number {
    let n = 0;
    for (const [, gh] of this.allies) if (!gh.downed) n++;
    return n;
  }

  /** Host player ghost. `pvp` gives it a collider + CombatTarget so the
   *  client's bullets can HIT the host (claims settle on the host). */
  ensureAlly(pvp = false): AllyGhost {
    let ally: AllyGhost | null = this.allyGhost;
    if (ally === null) {
      ally = new AllyGhost(this.physics, this.scene, this.terrain, 0, 0);
      this.group.add(ally.mesh);
      ally.hurt = (d: number, point: THREE.Vector3) => {
        // claim: target 1 = host body
        this.onClaim?.(1, Math.round(d), point.clone());
        return false; // the host settles its own health
      };
      this.allyGhost = ally;
    }
    ally.setPvp(pvp);
    return ally;
  }

  /** Client tick: ally ghosts lerp toward their last known spot. */
  syncAlly(dt: number) {
    this.allyGhost?.update(dt, this.terrain);
  }

  claim(enemyId: number, dmg: number, point: THREE.Vector3) {
    this.onClaim?.(enemyId, dmg, point);
  }

  clear() {
    for (const [, gh] of this.ghosts) gh.dispose();
    this.ghosts.clear();
    for (const [, gh] of this.allies) this.group.remove(gh.mesh);
    this.allies.clear();
    const ally = this.group.getObjectByName('ally-ghost');
    if (ally) this.group.remove(ally);
  }

  update(dt: number) {
    for (const [, gh] of this.ghosts) gh.update(dt);
    this.allyGhost?.update(dt, this.terrain);
  }
}

/** The HOST player on the client: mesh always; collider only in PvP. */
export class AllyGhost {
  mesh: THREE.Group;
  body: RAPIER.RigidBody | null = null;
  collider: RAPIER.Collider | null = null;
  side = 'ally' as const;
  downed = false;
  classKey = 'rifle';
  lastShot = -1e9;
  alive = true;
  hp = 100;
  /** Set in PvP so local bullets can claim hits on the host player. */
  hurt: ((d: number, point: THREE.Vector3) => void) | null = null;
  private tx = 0;
  private tz = 0;

  constructor(
    private physics: PhysicsLike,
    scene: THREE.Scene,
    private terrain: { heightAt(x: number, z: number): number },
    x: number,
    z: number
  ) {
    this.mesh = soldierMesh(0x6fd06f);
    this.mesh.position.set(x, terrain.heightAt(x, z), z);
    scene.add(this.mesh);
    this.tx = x;
    this.tz = z;
  }

  pos(): THREE.Vector3 {
    return this.mesh.position.clone();
  }

  eye(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(this.mesh.position.x, this.mesh.position.y + 1.2, this.mesh.position.z);
  }

  setPvp(pvp: boolean) {
    if (pvp && !this.body) {
      const p = this.mesh.position;
      const half = (1.7 * 0.9) / 2 - 0.32;
      this.body = this.physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y + 1.0, p.z)
      );
      this.collider = this.physics.world.createCollider(
        RAPIER.ColliderDesc.capsule(half, 0.32).setFriction(0),
        this.body
      );
      // weapon hit resolution matches on {type:'enemy', soldier}
      this.body.userData = { type: 'enemy', soldier: this };
    }
  }

  /** Snapshot-driven position of the host player. */
  setTarget(x: number, y: number, z: number) {
    this.tx = x;
    this.tz = z;
    void y;
  }

  update(dt: number, terrain: { heightAt(x: number, z: number): number }) {
    const dx = this.tx - this.mesh.position.x;
    const dz = this.tz - this.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.02) {
      const step = Math.min(d, 14 * dt);
      this.mesh.position.x += (dx / d) * step;
      this.mesh.position.z += (dz / d) * step;
    }
    this.mesh.position.y = terrain.heightAt(this.mesh.position.x, this.mesh.position.z);
    if (this.body) {
      const p = this.mesh.position;
      this.body.setNextKinematicTranslation({ x: p.x, y: p.y + 1.0, z: p.z });
    }
  }
}

/** A single client-side enemy ghost: kinematic body + CombatTarget wrapper. */
class GhostEnemy implements CombatTarget {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Group;
  alive = true;
  hp = 100;
  downed = false;
  side = 'hostile' as const;
  classKey = 'rifle';
  lastShot = -1e9;
  private tx: number;
  private tz: number;

  constructor(
    physics: PhysicsLike,
    scene: THREE.Scene,
    terrain: { heightAt(x: number, z: number): number },
    private swarm: GhostSwarm,
    readonly id: number,
    x: number,
    z: number
  ) {
    const gy = terrain.heightAt(x, z);
    const half = (1.7 * 0.9) / 2 - 0.32;
    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, gy + half + 0.32, z)
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(half, 0.32).setFriction(0),
      this.body
    );
    this.tx = x;
    this.tz = z;
    // weapon hit resolution matches on {type:'enemy', soldier}
    this.body.userData = { type: 'enemy', soldier: this };
    this.mesh = soldierMesh(0xc0392b);
    this.mesh.position.set(x, gy, z);
    scene.add(this.mesh);
  }

  applySnapshot(x: number, z: number, hp: number) {
    this.tx = x;
    this.tz = z;
    this.hp = hp;
    this.alive = hp > 0;
  }

  pos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  eye(out = new THREE.Vector3()): THREE.Vector3 {
    const t = this.body.translation();
    return out.set(t.x, t.y + 0.55, t.z);
  }

  update(dt: number) {
    const t = this.body.translation();
    const dx = this.tx - t.x;
    const dz = this.tz - t.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.02) {
      const step = Math.min(d, 14 * dt);
      this.body.setNextKinematicTranslation({
        x: t.x + (dx / d) * step,
        y: t.y,
        z: t.z + (dz / d) * step,
      });
    }
    const tr = this.body.translation();
    this.mesh.position.set(tr.x, tr.y - 0.95, tr.z);
  }

  /** Local weapon hit ???CLAIM (host verifies and settles). */
  hurt(d: number, point: THREE.Vector3, _dir: THREE.Vector3): boolean {
    if (!this.alive) return false;
    this.swarm.claim(this.id, Math.round(d), point.clone());
    return false; // the host decides kills ???client never scores locally
  }

  dispose() {
    this.mesh.removeFromParent();
    try {
      this.swarm.physics.world.removeRigidBody(this.body);
    } catch {
      /* already gone */
    }
  }
}
