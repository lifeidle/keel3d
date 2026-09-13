// Armoured tanks ???the H package's driveable layer.
//
// One class powers BOTH tanks: the player's driveable main battle tank and the
// enemy AI tank that hunts the player. Movement follows the same pattern the
// enemies already use (dynamic Rapier body + gravity sits it on the terrain,
// rotations locked, we steer the visual yaw ourselves), so a tank can never
// flip over and it slides around walls exactly like infantry do.
//
// The collider is a vertical cylinder (radius ???hull) because the body's
// rotation is locked ???a cylinder is symmetric, so bumping geometry never
// depends on which way the hull happens to point.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d';
import { CONFIG } from '../../../config';
import { PhysicsWorld, type Vec3 } from '../../../physics/world';
import { Terrain } from '../../../world/terrain';
import { Effects } from '../effects';
import { Audio } from '../audio/audio';
import type { Enemy } from '../ai/enemy';

export interface TankHooks {
  effects: Effects;
  audio: Audio;
  physics: PhysicsWorld;
  terrain: Terrain;
  /** All living infantry enemies (shells + crush + blast damage them). */
  getEnemies: () => unknown[] // hits resolve via collider userData;
  /**
   * Damage aimed at the PLAYER (AI shells). The game routes it: while driving,
   * it hits the player tank's hull instead of the driver.
   */
  damagePlayer: (d: number, source?: { x: number; z: number }) => void;
  /** Called when ANY tank is destroyed. `player` true if the player was inside. */
  onTankDestroyed: (t: Tank, playerInside: boolean) => void;
  /** Muzzle flash light at the gun's world position (pooled in the game). */
  muzzleFlash?: (pos: THREE.Vector3, radius: number, strength: number) => void;
  /** Jeep-specific: fired when the driveable scout jeep is destroyed. */
  onJeepDestroyed?: () => void;
  /** Camera shake hook (jeep MG recoil routes into the game's trauma pool). */
  addShake?: (amount: number) => void;
}

interface ShellRec {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  life: number;
  fromPlayer: boolean;
}

let _shellGeo: THREE.SphereGeometry | null = null;
let _shellMat: THREE.MeshBasicMaterial | null = null;

/** Move `v` toward `target` by at most `delta` (signed, no overshoot). */
function clampApproach(v: number, target: number, delta: number): number {
  if (v < target) return Math.min(v + delta, target);
  if (v > target) return Math.max(v - delta, target);
  return target;
}

/**
 * Build the tank hull visuals (port of the V5 reference tank, refactored so
 * the turret + cannon stay addressable for aiming). Group origin = ground
 * under the hull centre, +Y up, gun faces -Z at yaw 0.
 */
export function buildTankRig(burnt = false): {
  group: THREE.Group;
  turret: THREE.Group;
  cannon: THREE.Group;
  muzzle: THREE.Object3D;
} {
  const group = new THREE.Group();
  const camo = new THREE.MeshStandardMaterial({
    color: burnt ? 0x2e2c26 : 0x4e5a42,
    roughness: burnt ? 1 : 0.72,
    metalness: burnt ? 0.1 : 0.3,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: burnt ? 0x161514 : 0x24282c,
    roughness: 0.85,
    metalness: 0.5,
  });
  const trackMat = new THREE.MeshStandardMaterial({
    color: burnt ? 0x171615 : 0x3a3c38,
    roughness: 0.95,
    metalness: 0.4,
  });
  const add = (parent: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number, rotX = 0) => {
    mesh.position.set(x, y, z);
    if (rotX) mesh.rotation.x = rotX;
    mesh.castShadow = true;
    parent.add(mesh);
  };

  // tracks + road wheels (visual only; the collider is a cylinder)
  for (const tx of [-1.15, 1.15]) {
    add(group, new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 5.4), trackMat), tx, 0.4, 0);
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.74, 10), dark);
      w.rotation.z = Math.PI / 2;
      add(group, w, tx, 0.42, -2 + i * 1.0);
    }
  }
  // hull + glacis + engine deck
  add(group, new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.85, 4.7), camo), 0, 1.05, 0);
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.7, 1.2), camo);
  add(group, glacis, 0, 0.95, -2.55, 0.5);
  add(group, new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 1.6), camo), 0, 1.55, 1.5);

  // turret (independent rotation)
  const turret = new THREE.Group();
  turret.position.set(0, 1.72, 0.2);
  add(turret, new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 2.5), camo), 0, 0.15, 0);
  add(turret, new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.8), camo), 0, 0.12, 1.5);
  // main gun
  const cannon = new THREE.Group();
  cannon.position.set(0, 0.22, -1.1);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 3.4, 10), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -1.7;
  barrel.castShadow = true;
  cannon.add(barrel);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 8), dark);
  brake.rotation.x = Math.PI / 2;
  brake.position.z = -3.2;
  cannon.add(brake);
  turret.add(cannon);
  // hatches + hull MG
  add(turret, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), camo), -0.4, 0.5, 0.5);
  add(turret, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.9), dark), 0.5, 0.55, -0.3);
  group.add(turret);
  // gun-muzzle marker (local to turret; fired from here)
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.22, -4.6);
  turret.add(muzzle);

  return { group, turret, cannon, muzzle };
}

export class Tank {
  body: RAPIER.RigidBody;
  readonly hull: RAPIER.Collider;
  group: THREE.Group;
  private turret: THREE.Group;
  private cannon: THREE.Group;
  private muzzle: THREE.Object3D;
  // GLB cosmetic layer (Quaternius Tank.glb): visual-only, driven by the
  // procedural rig's transforms. Nodes: Tank_Turret / Tank_Gun / armature.
  private glbTurret: THREE.Object3D | null = null;
  private glbGun: THREE.Object3D | null = null;
  private glbMixer: THREE.AnimationMixer | null = null;
  private glbActions: Record<string, THREE.AnimationAction> = {};
  private glbCurrentClip = '';

  // world state
  yaw = 0; // hull heading
  turretYaw = 0; // turret traverse relative to hull (rad)
  gunPitch = 0;
  speed = 0; // signed m/s (negative = reversing)
  hp: number;
  readonly maxHp: number;
  alive = true;
  /** True when the human is driving this tank. */
  driver = false;
  /** True when this is the enemy AI tank (hunts the player). */
  ai = false;
  private aiSight = 65; // m ???engages when the player is inside this
  private aiPreferred = 30; // m ???stops closing in at this range
  private aiFireCd = 0;
  private aiIdleT = 0;
  private fireCd = 0; // reload countdown after each shot
  private shellCd = 0; // brief delay before the round leaves (muzzle "lift")
  private pendingShell: { dir: THREE.Vector3 } | null = null;
  private clankT = 0; // turret-traverse sound throttle
  private crushed = new Set<Enemy>(); // enemies run over recently

  private shells: ShellRec[] = [];
  private shellsGroup = new THREE.Group();

  constructor(
    private hooks: TankHooks,
    x: number,
    z: number,
    yaw: number,
    opts: { hp?: number; ai?: boolean } = {}
  ) {
    const T = CONFIG.tank;
    this.maxHp = opts.hp ?? (opts.ai ? T.enemyHp : T.hp);
    this.hp = this.maxHp;
    this.ai = opts.ai ?? false;
    this.yaw = yaw;
    const gy = hooks.terrain.heightAt(x, z);

    // collision: a short cylinder (rotation locked, so a symmetric shape).
    // Spawn with the cylinder's BOTTOM on the ground so the tank reads as
    // sitting even before the first physics step (menu orbit camera sees it).
    this.body = hooks.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, gy + T.colliderHalfH + 0.05, z)
        .lockRotations()
        .setLinearDamping(0.6)
        .setCcdEnabled(true)
    );
    this.hull = hooks.physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(T.colliderHalfH, T.colliderR)
        .setFriction(0.9)
        .setDensity(3),
      this.body
    );
    this.body.userData = { type: 'tank', tank: this };

    const rig = buildTankRig(this.ai);
    this.group = rig.group;
    this.turret = rig.turret;
    this.cannon = rig.cannon;
    this.muzzle = rig.muzzle;
    this.group.position.set(x, gy, z);
    this.group.rotation.y = yaw;
  }

  /** Scene attachment ???the physics wrapper has no scene, so TankManager adds. */
  attach(scene: THREE.Scene) {
    scene.add(this.group);
    // cosmetic GLB tank ???SHELVED (user decision 2026-09-08): the procedural
    // low-poly rig is the canonical look. Flip to true to restore the skin.
    const USE_GLB_TANK = false;
    if (USE_GLB_TANK) {
      new GLTFLoader().load('/models/tank.glb', (gltf) => {
        const root = gltf.scene;
        root.scale.setScalar(0.4);
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
        });
        // Quaternius tank models face +X; the logic rig faces -Z ???rotate +90°
        root.rotation.y = -Math.PI / 2;
        this.glbTurret = root.getObjectByName('Tank_Turret') ?? null;
        this.glbGun = root.getObjectByName('Tank_Gun') ?? null;
        this.glbMixer = new THREE.AnimationMixer(root);
        for (const clip of gltf.animations) {
          this.glbActions[clip.name.split('|').pop() ?? clip.name] = this.glbMixer.clipAction(clip);
        }
        this.group.add(root);
        // hide ALL procedural meshes (deep traverse, any depth) but keep the
        // GLB subtree visible ???the old turret/cannon are Groups, not Meshes,
        // so a shallow children loop missed them
        const glbSet = new Set<THREE.Object3D>();
        root.traverse((o) => glbSet.add(o));
        this.group.traverse((o) => {
          if ((o as THREE.Mesh).isMesh && !glbSet.has(o)) o.visible = false;
        });
      }, undefined, () => { /* load failed: procedural look stays */ });
    }
    scene.add(this.shellsGroup);
  }

  get pos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  /** Aiming reference: world-space muzzle + forward dir of the gun. */
  muzzleWorld(): { pos: THREE.Vector3; dir: THREE.Vector3 } {
    this.group.updateMatrixWorld(true);
    const pos = this.muzzle.getWorldPosition(new THREE.Vector3());
    // forward in the turret frame is -Z; pitch rotates the cannon group
    const a = this.yaw + this.turretYaw;
    const p = this.gunPitch;
    const dir = new THREE.Vector3(
      -Math.sin(a) * Math.cos(p),
      Math.sin(p),
      -Math.cos(a) * Math.cos(p)
    ).normalize();
    return { pos, dir };
  }

  damage(amount: number) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.destroy();
    }
  }

  /** Blast/HEAT hit: tanks take the full punch (unlike bullets). */
  blastHit(amount: number) {
    this.damage(amount);
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    const p = this.pos;
    p.y += 0.6;
    this.hooks.effects.explosion(p);
    this.hooks.audio.playExplosion();
    // hull scorched black
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && mat.color) mat.color.setHex(0x141412);
      }
    });
    this.hooks.onTankDestroyed(this, this.driver);
    // smoke column over the wreck (managed by the caller via plumes)
  }

  /** Fire the main gun (returns true when a shell was actually launched). */
  tryFire(): boolean {
    if (!this.alive || this.fireCd > 0 || this.pendingShell) return false;
    const T = CONFIG.tank;
    this.fireCd = T.reload;
    this.shellCd = 0.12; // the round takes a moment to leave the muzzle
    this.hooks.audio.playCannon(this.driver);
    this.hooks.audio.playTankReload();
    // aim point already locked in by the AI/player before the shell leaves
    const mzw = this.muzzleWorld();
    this.hooks.muzzleFlash?.(mzw.pos, 15, 5); // big warm flash at the barrel
    this.pendingShell = { dir: mzw.dir.clone() };
    return true;
  }

  private launchShell(dir: THREE.Vector3) {
    const T = CONFIG.tank;
    const { pos } = this.muzzleWorld();
    if (!_shellGeo) _shellGeo = new THREE.SphereGeometry(0.14, 8, 8);
    if (!_shellMat)
      _shellMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(_shellGeo, _shellMat);
    mesh.position.copy(pos);
    this.shellsGroup.add(mesh);
    this.shells.push({
      mesh,
      pos: pos.clone(),
      dir,
      life: T.shellRange / T.shellSpeed,
      fromPlayer: this.driver,
    });
  }

  /** Advance shells. Returns kills scored by this tank this frame. */
  private updateShells(dt: number): number {
    const T = CONFIG.tank;
    let kills = 0;
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.life -= dt;
      const step = T.shellSpeed * dt;
      const next = s.pos.clone().addScaledVector(s.dir, step);

      // wall/cover check along the step (skip our own hull)
      const hit = this.hooks.physics.raycast(
        { x: s.pos.x, y: s.pos.y, z: s.pos.z },
        { x: s.dir.x, y: s.dir.y, z: s.dir.z },
        step + 0.4,
        this.hull
      );
      let impact: THREE.Vector3 | null = null;
      if (hit) {
        impact = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
        const ud = (hit.collider.parent()?.userData ?? {}) as any;
        if (ud.type === 'enemy' && ud.enemy?.alive) {
          const e = ud.enemy;
          const was = e.alive;
          e.damage(T.shellDamage, impact.clone(), s.dir);
          if (was && !e.alive) kills++;
        } else if (ud.type === 'tank' && ud.tank && ud.tank !== this) {
          // HEAT round vs armour: multiply the splash damage against hulls
          ud.tank.blastHit(T.shellDamage * 2.2);
        } else if (ud.type === 'barrel' && ud.barrel) {
          ud.barrel.hit(9999); // detonate on a direct shell hit
        } else if (ud.type === 'crate' && ud.rec) {
          ud.rec.hit(T.shellDamage);
        }
      } else {
        // nothing in the step ???fly on, or fizzle at max range
        if (s.life <= 0) impact = next.clone();
      }

      if (impact) {
        // detonate: blast FX + radial damage to everyone nearby
        this.explodeAt(impact, T.shellDamage, s.fromPlayer);
        this.hooks.effects.tracer(s.pos, impact);
        this.shellsGroup.remove(s.mesh);
        this.shells.splice(i, 1);
        continue;
      }
      s.pos.copy(next);
      s.mesh.position.copy(next);
    }
    return kills;
  }

  /** HE round detonation: radial infantry damage + player damage + FX. */
  private explodeAt(p: THREE.Vector3, dmg: number, fromPlayer: boolean) {
    const T = CONFIG.tank;
    this.hooks.effects.explosion(p);
    this.hooks.audio.playExplosion();
    for (const e of this.hooks.getEnemies() as Enemy[]) {
      if (!e.alive) continue;
      const t = e.body.translation();
      const d = Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z);
      if (d > T.shellRadius) continue;
      const f = Math.max(0, 1 - d / T.shellRadius) + T.shellEdge;
      const dir = new THREE.Vector3(t.x - p.x, 0.6, t.z - p.z).normalize();
      e.damage(dmg * f, p.clone(), dir);
    }
    // splash on the player only when the shell was fired BY the enemy AI tank
    // (friendly shells fired from the player's own tank never damage them ???
    //  and a player driving a tank is shielded, damage routes to the hull)
    if (!fromPlayer) {
      this.hooks.damagePlayer(Math.round(dmg * 0.55), { x: p.x, z: p.z });
    }
  }

  /**
   * Update as the player's driveable tank. The mouse steers the hull like an
   * FPS (gun locked to the hull front ???simplest aiming model for a driver),
   * so what the crosshair points at is what the main gun fires at.
   * Camera: first person sits in the gunner seat; third person trails behind.
   */
  updatePlayer(
    dt: number,
    move: { x: number; z: number },
    mouse: { x: number; y: number },
    fire: boolean,
    camera: THREE.PerspectiveCamera,
    thirdPerson: boolean,
    sensMul: number
  ) {
    const T = CONFIG.tank;
    if (!this.alive) return;

    // hull aim from the mouse (same sensitivity feel as on foot)
    const s = CONFIG.player.mouseSensitivity * sensMul;
    this.yaw -= mouse.x * s;
    this.gunPitch = THREE.MathUtils.clamp(
      this.gunPitch - mouse.y * s,
      T.gunPitchMin,
      T.gunPitchMax
    );
    this.turretYaw = 0; // gun locked to the hull for player driving

    // throttle: W/S speed, A/D nudges the turn (helps crab around cover)
    const fwd = move.z;
    if (fwd > 0.05) this.speed += T.accel * dt;
    else if (fwd < -0.05) this.speed -= T.accel * dt * 0.7;
    else this.speed *= Math.max(0, 1 - dt * 3.2);
    this.speed = THREE.MathUtils.clamp(this.speed, T.maxRev, T.maxSpeed);
    if (Math.abs(move.x) > 0.05) {
      // yaw grows counter-clockwise in three.js, so pressing D (right) must
      // SUBTRACT from it ???the old += made A and D steer backwards
      this.yaw -= move.x * T.turnRate * dt * 0.9;
      this.clankT -= dt;
      if (this.clankT <= 0) {
        this.hooks.audio.playTurret();
        this.clankT = 1.2;
      }
    }

    if (fire) this.tryFire();
    this.advance(dt, true);
    this.updateCamera(camera, thirdPerson);
  }

  /** First-person gunner seat or trailing chase camera. */
  private updateCamera(camera: THREE.PerspectiveCamera, thirdPerson: boolean) {
    const p = this.pos;
    const cp = this.hooks.terrain.heightAt(p.x, p.z);
    const yTop = cp + 1.95; // gunner seat height above the terrain
    if (!thirdPerson) {
      camera.position.set(p.x, yTop, p.z);
      camera.rotation.set(this.gunPitch, this.yaw, 0, 'YXZ');
      return;
    }
    // trailing cam: behind the hull, looking over the turret at the aim point
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    camera.position.set(
      p.x - fwd.x * 8.2,
      cp + 4.1,
      p.z - fwd.z * 8.2
    );
    const aim = new THREE.Vector3(
      p.x + fwd.x * 6,
      cp + 1.2 + Math.sin(this.gunPitch) * 20,
      p.z + fwd.z * 6
    );
    camera.lookAt(aim);
  }

  /** Update as the enemy AI tank: hunt the player, stop, aim, fire. */
  updateAI(dt: number, playerPos: THREE.Vector3, playerAlive: boolean) {
    const T = CONFIG.tank;
    if (!this.alive) return;

    // brief idle after spawn so the player isn't hunted instantly
    this.aiIdleT += dt;
    const hunting = this.aiIdleT > CONFIG.tank.driveTime;

    const dx = playerPos.x - this.pos.x;
    const dz = playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    this.aiFireCd -= dt;

    if (hunting && playerAlive && dist < this.aiSight) {
      const desiredYaw = Math.atan2(-dx, -dz); // face the player
      // hull: close in until preferred range, then hold position
      if (dist > this.aiPreferred + 4) {
        const spd = T.maxSpeed * 0.55;
        this.speed = clampApproach(this.speed, spd, T.accel * dt);
        // turn the hull slowly toward the target
        let dy = desiredYaw - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += THREE.MathUtils.clamp(dy, -T.turnRate * dt, T.turnRate * dt);
      } else {
        this.speed *= Math.max(0, 1 - dt * 3);
      }
      // turret: aim precisely (independent of hull)
      let tdy = desiredYaw - (this.yaw + this.turretYaw);
      tdy = Math.atan2(Math.sin(tdy), Math.cos(tdy));
      this.turretYaw += THREE.MathUtils.clamp(tdy, -T.turretRate * dt, T.turretRate * dt);
      // elevation to the player (rough: flat map approximation + slight lead)
      const dyWorld = playerPos.y - this.pos.y;
      this.gunPitch = THREE.MathUtils.clamp(
        Math.atan2(dyWorld, Math.max(dist, 1)) * 0.6,
        T.gunPitchMin,
        T.gunPitchMax
      );
      // fire when aimed close enough AND the gun has a clear line (no walls)
      if (this.aiFireCd <= 0 && Math.abs(tdy) < 0.06 && this.hasLineTo(playerPos)) {
        this.aiFireCd = T.reload + 0.6;
        if (this.tryFire()) {
          // scatter the shell slightly so the player can dodge
          if (this.pendingShell) {
            const s = this.pendingShell.dir;
            s.x += (Math.random() - 0.5) * 0.02;
            s.y += (Math.random() - 0.5) * 0.01;
            s.z += (Math.random() - 0.5) * 0.02;
            s.normalize();
          }
        }
      }
    } else {
      this.speed *= Math.max(0, 1 - dt * 2);
    }
    this.advance(dt, false);
  }

  /** Clear sight to a point? (AI won't shell through hills/buildings, but a
   *  tank hull in the way is a valid target ???the shell can hit it.) */
  private hasLineTo(p: THREE.Vector3): boolean {
    const from = this.muzzleWorld().pos;
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const dz = p.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1) return true;
    const hit = this.hooks.physics.raycast(
      { x: from.x, y: from.y, z: from.z },
      { x: dx / len, y: dy / len, z: dz / len },
      len,
      this.hull
    );
    if (!hit) return true;
    // players and other armour don't block the shot ???they ARE the target;
    // only world cover (walls, terrain, hamlets??? stops the AI from firing
    const ud = (hit.collider.parent()?.userData ?? {}) as any;
    return ud.type === 'tank' || ud.type === 'player' || ud.type === 'crate' || ud.type === 'barrel';
  }

  /** Shared per-frame motion + shell + fire processing. */
  private advance(dt: number, canCrush: boolean) {
    const T = CONFIG.tank;
    // muzzle lift: the round leaves shortly after the trigger
    if (this.shellCd > 0) {
      this.shellCd -= dt;
      if (this.shellCd <= 0 && this.pendingShell) {
        this.launchShell(this.pendingShell.dir);
        this.pendingShell = null;
      }
    }
    if (this.fireCd > 0) this.fireCd -= dt;

    // drive the body with our heading
    const vx = -Math.sin(this.yaw) * this.speed;
    const vz = -Math.cos(this.yaw) * this.speed;
    const cur = this.body.linvel();
    this.body.setLinvel({ x: vx, y: cur.y, z: vz }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);

    // sync visuals to the body (terrain keeps the body glued down)
    const tr = this.body.translation();
    // the hull group's origin is the ground line; the collider's bottom sits
    // at body.y - halfH, so drop the visual by that offset for an exact seat
    const groundY = tr.y - CONFIG.tank.colliderHalfH;
    this.group.position.set(tr.x, groundY, tr.z);
    this.group.rotation.y = this.yaw;
    this.turret.rotation.y = this.turretYaw;
    this.cannon.rotation.x = this.gunPitch;
    // drive the GLB cosmetic layer from the procedural rig
    if (this.glbTurret) this.glbTurret.rotation.y = this.turretYaw;
    if (this.glbGun) this.glbGun.rotation.x = this.gunPitch;
    if (this.glbMixer) {
      this.glbMixer.update(dt);
      const want = this.speed > 0.3 ? 'Tank_Forward' : this.speed < -0.3 ? 'Tank_Backwards' : '';
      if (want && this.glbCurrentClip !== want) {
        this.glbActions[want]?.reset().play();
        if (this.glbCurrentClip && this.glbActions[this.glbCurrentClip]) this.glbActions[this.glbCurrentClip].fadeOut(0.2);
        this.glbCurrentClip = want;
      } else if (!want && this.glbCurrentClip) {
        this.glbActions[this.glbCurrentClip]?.fadeOut(0.2);
        this.glbCurrentClip = '';
      }
    }

    // crush infantry we roll over (player tank only ???fun, and counts as kills)
    if (canCrush && Math.abs(this.speed) > 2.5) {
      const r2 = (CONFIG.tank.colliderR + 0.5) ** 2;
      for (const e of this.hooks.getEnemies() as Enemy[]) {
        if (!e.alive || this.crushed.has(e)) continue;
        const t = e.body.translation();
        const dx = t.x - tr.x;
        const dz = t.z - tr.z;
        if (dx * dx + dz * dz < r2) {
          this.crushed.add(e);
          e.damage(999, new THREE.Vector3(t.x, t.y, t.z), new THREE.Vector3(dx, 0, dz));
        }
      }
    }
    // forget crush tags once enemies leave the hull or die
    for (const e of [...this.crushed]) {
      if (!e.alive) this.crushed.delete(e);
      else {
        const t = e.body.translation();
        if ((t.x - tr.x) ** 2 + (t.z - tr.z) ** 2 > 30) this.crushed.delete(e);
      }
    }

    // shells fly + may score kills (mission progress counts them)
    const killed = this.updateShells(dt);
    void killed;
  }

  /** Free all scene + physics resources (map regenerate). */
  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    scene.remove(this.shellsGroup);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = (m as unknown as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.shellsGroup.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry !== _shellGeo) m.geometry.dispose();
    });
    try {
      this.hooks.physics.world.removeRigidBody(this.body);
    } catch {
      /* already gone */
    }
  }
}
