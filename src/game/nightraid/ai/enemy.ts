// Enemy AI: dynamic capsule that walks toward the player, shoots on line-of-sight,
// and becomes a tumbling ragdoll on death. Physics + simple state machine.
// Stats, tint, gun model and fire sound all come from the class archetype
// (rifle / smg / marksman) picked by the EnemyManager at spawn time.
// Visuals are procedural: helmeted head, swinging legs, per-class gun model,
// plus a muzzle flash sprite + tracer when they shoot so the player can spot
// where fire is coming from in the dark.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createGltfLoader, modelUrl } from '../../../engine/assets/gltf';
import { buildSoldierRig } from '../soldiers/SoldierFactory';
import * as Steering from '../../../blocks/Steering';

// --- soldier GLB cosmetic layer (Quaternius Animated Men, CC0) ---
// One template is fetched once; every Enemy clones it (skinned meshes must
// be per-instance, but the download + decode happens a single time).
let soldierTpl: THREE.Object3D | null = null;
let soldierClips: THREE.AnimationClip[] = [];
const soldierWaiters: Array<(t: THREE.Object3D, c: THREE.AnimationClip[]) => void> = [];
let soldierLoading = false;
function ensureSoldier(cb: (t: THREE.Object3D, c: THREE.AnimationClip[]) => void) {
  if (soldierTpl) return void cb(soldierTpl, soldierClips);
  soldierWaiters.push(cb);
  if (soldierLoading) return;
  soldierLoading = true;
  createGltfLoader().load(
    modelUrl('soldier.glb'),
    (gltf) => {
      soldierTpl = gltf.scene;
      soldierClips = gltf.animations;
      for (const fn of soldierWaiters.splice(0)) fn(soldierTpl!, soldierClips);
    },
    undefined,
    () => {
      soldierLoading = false; // fall back to the procedural soldier forever
    }
  );
}

// rifle (Quaternius AssaultRifle_1, CC0) attached to the right hand bone
let rifleTpl: THREE.Object3D | null = null;
const rifleWaiters: Array<(t: THREE.Object3D) => void> = [];
let rifleLoading = false;
function ensureRifle(cb: (t: THREE.Object3D) => void) {
  if (rifleTpl) return void cb(rifleTpl);
  rifleWaiters.push(cb);
  if (rifleLoading) return;
  rifleLoading = true;
  createGltfLoader().load(
    modelUrl('rifle.glb'),
    (gltf) => {
      rifleTpl = gltf.scene;
      for (const fn of rifleWaiters.splice(0)) fn(rifleTpl!);
    },
    undefined,
    () => {
      rifleLoading = false;
    }
  );
}
import RAPIER from '@dimforge/rapier3d';
import { CONFIG } from '../../../config';
import type { EnemyClassDef } from '../../../config';
import { PhysicsWorld } from '../../../physics/world';
import { Audio } from '../audio/audio';
import { Player } from '../player/player';
import { CombatVfx } from '../../../blocks/fx/CombatVfx';

// scratch objects for the per-frame rifle orientation (no per-frame allocs)
const Q_HAND = new THREE.Quaternion();
const Q_ROOT = new THREE.Quaternion();
const Q_DESIRED = new THREE.Quaternion();
const M_BASIS = new THREE.Matrix4();
const V_FWD = new THREE.Vector3();
const V_Y = new THREE.Vector3();
const V_Z = new THREE.Vector3();

// GLB Quaternius soldier layer —SHELVED (user decision 2026-09-08: the skinned
// model read worse than the low-poly blocky soldier). The blocky procedural
// soldier is canonical; its animation lives in the locomotion block below.
// Flip this to true to bring the cosmetic GLB layer back.
const USE_GLB_SOLDIER = false;
import { buildEnemyGun } from '../world/gunmodels';

const HAS_DOM = typeof document !== 'undefined';

let _muzzleTex: THREE.Texture | null = null;

/** Radial warm-white glow for muzzle flashes (shared across all enemies). */
function muzzleGlowTexture(): THREE.Texture {
  if (_muzzleTex) return _muzzleTex;
  if (!HAS_DOM) {
    return (_muzzleTex = new THREE.DataTexture(new Uint8Array([255, 210, 140, 255]), 1, 1, THREE.RGBAFormat));
  }
  const size = 32;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,230,1)');
  g.addColorStop(0.4, 'rgba(255,200,110,0.9)');
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (_muzzleTex = t);
}

export type Side = 'hostile' | 'ally';

/**
 * Anything a soldier can aim at: another soldier, or the player wrapped by the
 * manager. Uniform shape lets hostiles engage the player AND friendly squad
 * members, and lets allies fight back —one AI for both sides.
 */
export interface CombatTarget {
  pos(): THREE.Vector3;
  eye(): THREE.Vector3;
  collider: RAPIER.Collider;
  alive: boolean;
  /** Apply damage from `by`; returns true when the hit was fatal. */
  hurt(d: number, point: THREE.Vector3, dir: THREE.Vector3, by: Enemy): boolean;
}

export class Enemy implements CombatTarget {
  body: RAPIER.RigidBody;
  readonly side: Side;
  collider: RAPIER.Collider;
  mesh: THREE.Group;
  health: number;
  alive = true;
  lastShot = -1e9; // perf.now()/1000 of the last trigger pull (radar pings)
  /** Operation-scale multipliers (enemy strength from the menu pick). */
  dmgMul = 1;
  hpMul = 1;

  /** Apply the menu difficulty multipliers (must run before first damage). */
  applyScale(dmgMul: number, hpMul: number) {
    this.dmgMul = dmgMul;
    this.hpMul = hpMul;
    this.health = this.cls.maxHealth * hpMul;
  }
  private fireCd = Math.random() * 0.5;
  /** Rally point for the assault command (enemy camp direction), if known. */
  camp: THREE.Vector3 | null = null;
  private seeT = 0.15 + Math.random() * 0.5; // staggered line-of-sight recheck
  /** Night-recon modifiers: hostiles see shorter and shoot wilder in the dark.
   *  Set by EnemyManager.setNight; allies are unaffected (player-side advantage). */
  sightMul = 1;
  spreadMul = 1;
  /** Squad command (allies only): follow the player, push the camp, or dig in. */
  command: 'follow' | 'assault' | 'hold' = 'follow';
  /** Class key for HUD/map styling (rifle / smg / marksman / rpg / lmg). */
  get classKey() {
    return this.cls.key;
  }
  /** Fixed flank side (+1 right / -1 left) so a squad naturally spreads. */
  flankSide = Math.random() < 0.5 ? -1 : 1;
  /** Downed-but-rescuable state (allies only): bleeding out on a timer. */
  downed = false;
  /** Set by the manager: dying hostiles may drop a medkit at this spot. */
  onDeath: ((pos: THREE.Vector3) => void) | null = null;
  /** RPG specialists: one rocket in flight at a time (self-managed). */
  private rocket: {
    mesh: THREE.Mesh;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    dmg: number;
    life: number;
  } | null = null;
  private downedT = 0;
  private static readonly BLEED_OUT = 25; // seconds until it's fatal
  private lastSeen = false; // cached LOS result against the current target
  private lastKnown: { x: number; z: number } | null = null; // last confirmed foe spot
  private investigateT = 0; // seconds spent sweeping that spot before giving up
  /** Timestamp of death (perf.now) —old ragdolls are culled by the manager. */
  diedAt = Infinity;
  // marksman laser aim: a visible red line while lining up, so the player
  // gets a beat to react instead of dying to invisible long-range fire
  private laser: THREE.Line | null = null;
  private aiming = false;
  private aimT = 0;
  private flash = 0; // body emissive damage-flash
  private flashT = 0; // muzzle flash timer
  private hitT = 0; // hit-reaction lean timer
  private walkPhase = 0;
  private aimBlend = 0; // 0 = low-ready carry, 1 = aiming at a seen target
  private idlePhase = 0; // breathing / micro-motion while standing
  private legL: THREE.Group;
  private legR: THREE.Group;
  private armB: THREE.Group; // trailing arm (base rotation.x 0.35)
  private armF: THREE.Group; // leading arm holding the rifle (base 1.05)
  /** Limb roots toggled by distance LOD (torso always drawn). */
  private lodLimbs: THREE.Group[] = [];
  private lodLimbsOn = true;
  private gun: THREE.Group;
  private pivot: THREE.Group; // inner anim layer: sway/hit lean, never fights the ragdoll transform
  private muzzleObj: THREE.Object3D | null = null;
  private muzzleSprite: THREE.Sprite | null = null;
  private matBody: THREE.MeshStandardMaterial;
  private matHead: THREE.MeshStandardMaterial;
  private static readonly EMISSIVE_BASE = 0.12;

  /** Distance LOD: hide swinging limbs beyond ~28m (torso silhouette remains). */
  setLimbLod(show: boolean) {
    if (this.lodLimbsOn === show) return;
    this.lodLimbsOn = show;
    for (const g of this.lodLimbs) g.visible = show;
  }

  /** Cached vectors for target queries (avoids per-call allocs). */
  private tmpPos = new THREE.Vector3();
  private tmpEye = new THREE.Vector3();


  constructor(
    private physics: PhysicsWorld,
    private scene: THREE.Scene,
    private audio: Audio,
    private effects: CombatVfx,
    spawn: THREE.Vector3,
    private cls: EnemyClassDef,
    side: Side = 'hostile',
    private campPos: THREE.Vector3 | null = null
  ) {
    this.side = side;
    const r = CONFIG.enemy.radius;
    const half = CONFIG.enemy.height / 2 - r;
    const center = half + r;
    this.health = cls.maxHealth;

    this.body = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y + center, spawn.z)
        .lockRotations()
        .setLinearDamping(0.5)
    );
    this.collider = physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(half, r).setDensity(1.2).setFriction(0.4),
      this.body
    );
    this.body.userData = { type: side === 'ally' ? 'ally' : 'enemy', soldier: this };
    if (this.campPos) this.camp = new THREE.Vector3(this.campPos.x, 0, this.campPos.z);

    // --- mesh: shared-material, merged-geometry soldier (SoldierFactory) ---
    const uniform = side === 'ally' ? CONFIG.ally.color : cls.color;
    const rig = buildSoldierRig(side === 'ally' ? 'ally' : 'enemy', uniform, Enemy.EMISSIVE_BASE);
    this.mesh = rig.mesh;
    this.pivot = rig.pivot;
    this.armB = rig.armB;
    this.armF = rig.armF;
    this.legL = rig.legL;
    this.legR = rig.legR;
    // LOD hooks: limbs hide at distance (torso stays); avoids 4 extra draws far away
    this.lodLimbs = [this.armB, this.armF, this.legL, this.legR];
    // Body material is per-soldier (hit-flash + death tint); helmet/vest/boot/head
    // are shared across the army via MaterialCache.
    this.matBody = rig.mats.body.clone();
    this.matHead = rig.mats.head;
    // re-bind body-tinted limb meshes to the per-soldier flash material
    this.armB.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = this.matBody;
    });
    this.armF.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = this.matBody;
    });
    this.legL.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material !== rig.mats.boot) m.material = this.matBody;
    });
    this.legR.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material !== rig.mats.boot) m.material = this.matBody;
    });
    // torso body slot (first mesh in the torso group)
    const torsoGroup = this.pivot.children[0] as THREE.Group | undefined;
    if (torsoGroup) {
      const first = torsoGroup.children[0] as THREE.Mesh;
      if (first?.isMesh) first.material = this.matBody;
    }

    // class-specific gun, aimed toward the player so silhouettes read right
    this.gun = buildEnemyGun(cls.key);
    this.gun.position.set(0.18, 0.25, 0.42);
    this.gun.rotation.y = Math.PI; // barrel (-Z) now points at the player
    const mz = this.gun.getObjectByName('muzzle');
    if (mz) {
      this.muzzleObj = mz;
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: muzzleGlowTexture(),
          color: 0xffe6b8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0,
        })
      );
      spr.position.copy(mz.position);
      spr.scale.setScalar(0.001);
      this.gun.add(spr);
      this.muzzleSprite = spr;
    }

    this.pivot.add(this.gun);
    if (cls.key === 'marksman' && this.muzzleObj) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      this.laser = new THREE.Line(
        lg,
        new THREE.LineBasicMaterial({
          color: 0xff5040,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      this.laser.visible = false;
      scene.add(this.laser);
    }
    if (side === 'ally') {
      // small additive badge hovering over friendlies so they read instantly
      // in a firefight (hostiles stay unmarked —night ambushes stay fair)
      const badge = new THREE.Mesh(
        new THREE.CircleGeometry(0.1, 12),
        new THREE.MeshBasicMaterial({
          color: 0x9fe87a,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      badge.rotation.x = -Math.PI / 2;
      badge.position.y = 0.96;
      this.mesh.add(badge);
    }
    scene.add(this.mesh);
    // cosmetic GLB soldier: async clone, procedural parts hidden when ready
    if (USE_GLB_SOLDIER) {
      ensureSoldier((tpl, clips) => {
      const root = SkeletonUtils.clone(tpl);
      // normalise height to ~1.7m (model units vary per source pack)
      const bb = new THREE.Box3().setFromObject(root);
      const h = bb.max.y - bb.min.y;
      const s = h > 0 ? 1.7 / h : 1;
      root.scale.setScalar(s);
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.castShadow = true;
      });
      this.glbRoot = root;
      this.mesh.add(root);
      const glbSet = new Set<THREE.Object3D>();
      root.traverse((o) => glbSet.add(o));
      this.mesh.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !glbSet.has(o)) o.visible = false;
      });
      this.glbMixer = new THREE.AnimationMixer(root);
      for (const c of clips) {
        const key = c.name.split('|').pop() ?? c.name;
        this.glbAct[key] = this.glbMixer.clipAction(c);
      }
      // rifle rides the right hand bone (MiddleHand.R)
      ensureRifle((rtpl) => {
        const hand = root.getObjectByName('MiddleHandR');
        if (!hand) return;
        const rifle = (rtpl.children[0] ?? rtpl).clone(true);
        // calibrate from the real bbox (~3.1 raw units) to a true-to-life
        // 0.9 m rifle. The rifle lives INSIDE the height-scaled soldier root,
        // so the root scale must be divided OUT —multiplying by it shrinks
        // the gun to ~0.1-0.2 m in world space (effectively invisible).
        const rb = new THREE.Box3().setFromObject(rifle);
        const rl = Math.max(rb.max.x - rb.min.x, rb.max.z - rb.min.z, 0.01);
        const rs = 0.9 / Math.max(rl * root.scale.x, 1e-4);
        rifle.scale.setScalar(rs);
        rifle.position.set(0, -0.02, 0);
        hand.add(rifle);
        this.glbRifle = rifle;
        this.glbHand = hand;
      });
      });
    }
  }

  /** ?debug=1 probe: live GLB/rifle/gear/arm-lock state for automated self-tests. */
  debugInfo() {
    const out: Record<string, unknown> = { side: this.side, alive: this.alive, glb: !!this.glbRoot };
    const g = this.glbRoot;
    if (g) {
      let tot = 0, vis = 0;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { tot++; if (m.visible) vis++; }
      });
      out.meshes = tot;
      out.meshesVisible = vis;
      const hand = g.getObjectByName('MiddleHandR');
      out.handKids = hand ? hand.children.map((c) => c.type + ':' + c.name + ':' + (c as THREE.Mesh).isMesh) : null;
      // the rifle = the hand child that actually contains meshes (bones have none)
      let gun: THREE.Object3D | null = null;
      if (hand) {
        for (const c of hand.children) {
          let hasMesh = false;
          c.traverse((o) => { if ((o as THREE.Mesh).isMesh) hasMesh = true; });
          if (hasMesh) { gun = c; break; }
        }
      }
      out.rifle = !!gun;
      if (gun) {
        g.updateMatrixWorld(true);
        const rb = new THREE.Box3().setFromObject(gun);
        const size = rb.getSize(new THREE.Vector3());
        out.rifleExt = [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)];
        // barrel = rifle local X axis in world space
        const bx = new THREE.Vector3().setFromMatrixColumn(gun.matrixWorld, 0);
        out.barrelDir = [+bx.x.toFixed(2), +bx.y.toFixed(2), +bx.z.toFixed(2)];
        const gp = new THREE.Vector3();
        gun.getWorldPosition(gp);
        out.rifleWorldY = +gp.y.toFixed(2);
      }
      out.rootScale = +g.scale.x.toFixed(3);
      for (const n of ['Helmet', 'HelmetRim', 'Belt', 'PouchL', 'PouchR', 'BootL', 'BootR']) {
        const o = g.getObjectByName(n);
        if (o) {
          g.updateMatrixWorld(true);
          const p = new THREE.Vector3();
          o.getWorldPosition(p);
          out[n] = +p.y.toFixed(2);
        } else out[n] = null;
      }
      const ua = g.getObjectByName('UpperArmR');
      out.armX = ua ? +ua.rotation.x.toFixed(2) : null;
      const la = g.getObjectByName('LowerArmR');
      out.armLX = la ? +la.rotation.x.toFixed(2) : null;
    }
    return out;
  }

  damage(d: number, _point: THREE.Vector3, dir: THREE.Vector3) {
    if (!this.alive) return;
    this.health -= d;
    this.flash = 0.12;
    this.hitT = 0.18; // lean back from the impact
    this.audio.playEnemyHit();
    // getting shot reveals the shooter's bearing: turn toward the incoming
    // fire instead of blindly holding the old patrol heading
    {
      const t = this.body.translation();
      this.wakeTo(t.x - dir.x * 12, t.z - dir.z * 12);
    }
    // and juke sideways for a beat —standing still after a hit is dying
    this.dodgeT = 1.1 + Math.random() * 0.7;
    if (this.health <= 0) {
      // allies get ONE rescue window instead of instant death: they fall
      // wounded and bleed out —the player can pick them back up (F nearby)
      if (this.side === 'ally' && !this.downed) {
        this.fallWounded();
        return;
      }
      this.die(dir);
    }
  }

  private downedYaw = 0;
  // GLB cosmetic layer
  private glbRoot: THREE.Object3D | null = null;
  private glbMixer: THREE.AnimationMixer | null = null;
  private glbRifle: THREE.Object3D | null = null;
  private glbHand: THREE.Object3D | null = null;
  private glbAct: Record<string, THREE.AnimationAction> = {};
  private glbClip = '';
  /** Ally tactic flag: under 30% health they fall back toward the player. */
  lowHp = false;
  /** Hostile juke timer: strafing sideways after taking a hit. */
  private dodgeT = 0;

  /** Fall wounded: bleed-out timer, no movement or fire. The toppled pose is
   *  applied by the transform sync (which runs every frame and would else
   *  overwrite it from the physics body). */
  private fallWounded() {
    this.downed = true;
    this.downedT = Enemy.BLEED_OUT;
    this.health = 1; // one more solid hit while downed is fatal
    this.downedYaw = this.mesh.rotation.y;
    this.cancelAim();
    if (this.laser) this.laser.visible = false;
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    // yell for help (follows the UI language: 我中弹了 / wounded grunt)
    this.audio.playVoice('death', 0.9);
  }

  /** Revived by the player: half health, back on their feet. */
  revive() {
    this.downed = false;
    this.downedT = 0;
    this.health = Math.round(this.cls.maxHealth * 0.6);
  }

  /** Cancel a marksman's aim (target lost / blocked). */
  private cancelAim() {
    if (!this.aiming) return;
    this.aiming = false;
    if (this.laser) this.laser.visible = false;
  }

  /** Keep the red laser line glued from the muzzle to the target's eye. */
  private syncLaser(target: CombatTarget) {
    if (!this.laser) return;
    this.mesh.updateMatrixWorld(true);
    const mz = this.muzzleObj ? this.muzzleObj.getWorldPosition(new THREE.Vector3()) : null;
    if (!mz) return;
    const eye = target.eye();
    const arr = (this.laser.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    arr[0] = mz.x; arr[1] = mz.y; arr[2] = mz.z;
    arr[3] = eye.x; arr[4] = eye.y; arr[5] = eye.z;
    (this.laser.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.laser.visible = true;
  }

  /** A sound or an order drew attention: sweep toward a spot (LOS keeps
   *  rechecking while on the way, so contact re-engages the chase). */
  wakeTo(x: number, z: number) {
    this.lastKnown = { x, z };
    this.investigateT = 0;
  }

  private die(dir: THREE.Vector3) {
    this.alive = false;
    this.diedAt = performance.now();
    // hostile medkit drop —the reward loop keeps pushes sustainable
    if (this.side === 'hostile' && this.onDeath && Math.random() < 0.35) {
      const t = this.body.translation();
      this.onDeath(new THREE.Vector3(t.x, Math.max(t.y - 0.6, t.y - 1), t.z));
    }
    this.body.lockRotations(false, true);
    const knock = 2.5;
    this.body.applyImpulse({ x: -dir.x * knock, y: 2.5, z: -dir.z * knock }, true);
    this.body.setAngvel(
      { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 },
      true
    );
    this.matBody.color.setHex(CONFIG.colors.enemyDead);
    this.matBody.emissiveIntensity = 0.05;
    this.pivot.rotation.set(0, 0, 0); // ragdoll uses the body transform; reset the anim layer
    if (this.muzzleSprite) (this.muzzleSprite.material as THREE.SpriteMaterial).opacity = 0;
    if (this.laser) this.laser.visible = false;
    this.audio.playDeath();
    this.audio.playBodyDrop();
  }

  // ---- CombatTarget implementation (so soldiers can shoot soldiers) ----
  pos(): THREE.Vector3 {
    const t = this.body.translation();
    return this.tmpPos.set(t.x, t.y, t.z);
  }
  eye(): THREE.Vector3 {
    const t = this.body.translation();
    const half = CONFIG.enemy.height / 2 - CONFIG.enemy.radius;
    return this.tmpEye.set(t.x, t.y + half * 0.6, t.z);
  }
  /** Take damage from a shooter (`by` may be another soldier). */
  hurt(d: number, point: THREE.Vector3, dir: THREE.Vector3, by: Enemy): boolean {
    if (!this.alive) return false;
    // same-side bullets don't hurt (no friendly fire between soldiers)
    if (by && by.side === this.side) return false;
    const wasAlive = this.alive;
    this.damage(d, point, dir);
    return wasAlive && !this.alive;
  }

  /**
   * Advance one soldier. `foes` are the hostiles this side may engage (the
   * manager feeds hostiles→player+allies, allies→hostiles). `leader` is the
   * player position for allies to keep station on when nothing is in range.
   */
  update(
    dt: number,
    foes: CombatTarget[],
    physics: PhysicsWorld,
    leader: THREE.Vector3 | null
  ) {
    // ally self-preservation: wounded soldiers fall back to the player
    if (this.side === 'ally') this.lowHp = this.health < this.cls.maxHealth * 0.3;

    // push an in-flight rocket (RPG specialists)
    if (this.updateRocket(dt, physics, foes)) return;

    // downed: bleeding out, no behaviour —hope a squadmate arrives in time
    if (this.downed) {
      this.downedT -= dt;
      if (this.downedT <= 0) {
        this.downed = false;
        this.die(new THREE.Vector3(0, 0, 1));
      }
      // keep the ragdoll settled and the transform synced
      const tr = this.body.translation();
      this.mesh.position.set(tr.x, tr.y - 0.55, tr.z);
      this.mesh.rotation.set(-Math.PI / 2 * 0.88, this.downedYaw, 0);
      return;
    }

    // pick the nearest living foe
    const t = this.body.translation();
    let best: CombatTarget | null = null;
    let bestD = Infinity;
    for (const f of foes) {
      if (!f.alive) continue;
      const fp = f.pos();
      const d = Math.hypot(fp.x - t.x, fp.z - t.z);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }

    let toX = 0;
    let toZ = 0;
    if (this.alive && best) {
      const bp = best.pos();
      toX = bp.x - t.x;
      toZ = bp.z - t.z;
    }

    // hostiles chase anything in sight; allies only fight what comes within
    // their engagement radius (they stay with the player otherwise).
    // Line of sight is rechecked on a staggered timer, so nobody locks on or
    // fires through a wall —an obscured target reads as lost until it steps
    // back into view (then the timer catches it again within ~a second).
    // allies now use their class sight range like hostiles —the old flat
    // followRange(38) made them trail the player blind while a fight raged
    // two ridges over. Assault command extends it further (aggressive posture).
    const sight =
      this.cls.sightRange * this.sightMul * (this.side === 'ally' && this.command === 'assault' ? 1.3 : 1);
    const inSight = best !== null && bestD < sight;
    if (this.alive && best && inSight) {
      this.seeT -= dt;
      if (this.seeT <= 0) {
        this.seeT = 0.45 + Math.random() * 0.5;
        this.lastSeen = this.hasLineTo(best);
        if (this.lastSeen) {
          // remember where the foe was confirmed, so a lost target gets
          // investigated instead of instantly abandoned
          const bp = best.pos();
          this.lastKnown = { x: bp.x, z: bp.z };
          this.investigateT = 0;
        }
      }
    }
    const engaged = inSight && this.lastSeen;
    if (!engaged) this.cancelAim();
    if (this.alive && engaged) {
      const speed = this.cls.moveSpeed;
      // smg rushers close in; marksmen hold at range and never pass fireRange
      const holdAt = this.cls.key === 'marksman' ? this.cls.fireRange * 0.8 : 1.2;
      if (bestD > holdAt) {
        let nx = toX / bestD;
        let nz = toZ / bestD;
        // flank: BOTH sides approach at an angle instead of stacking into a
        // single firing lane (hold command keeps allies dug in)
        if (!(this.side === 'ally' && this.command === 'hold')) {
          [nx, nz] = this.flankVec(nx, nz);
        }
        // hit-dodge: strafe across the firing lane while the timer runs
        if (this.dodgeT > 0) {
          this.dodgeT -= dt;
          nx += -nz * this.flankSide * 0.8;
          nz += nx * this.flankSide * 0.8;
        }
        const v = this.body.linvel();
        this.body.setLinvel({ x: nx * speed, y: v.y, z: nz * speed }, true);
      } else {
        const v = this.body.linvel();
        this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
      }

      // shoot if in range. Marksmen expose a laser while lining up: the aim
      // breaks if the target slips out of sight before the beat completes.
      if (bestD < this.cls.fireRange && best) {
        if (this.laser) {
          if (!this.aiming) {
            this.fireCd -= dt;
            if (this.fireCd <= 0) {
              this.fireCd = 1 / this.cls.fireRate;
              this.aiming = true;
              this.aimT = CONFIG.enemy.aimTime;
              this.syncLaser(best);
            }
          } else {
            this.aimT -= dt;
            if (!this.hasLineTo(best)) this.cancelAim();
            else if (this.aimT <= 0) {
              this.aiming = false;
              this.shoot(best, physics);
            } else {
              this.syncLaser(best);
            }
          }
        } else {
          this.fireCd -= dt;
          if (this.fireCd <= 0) {
            this.fireCd = 1 / this.cls.fireRate;
            this.shoot(best, physics);
          }
        }
      }
    } else if (this.alive && leader && this.side === 'ally') {
      // no hostiles in contact —behaviour depends on the squad command
      const A = CONFIG.ally;
      const v = this.body.linvel();
      if (this.command === 'hold') {
        // dig in: stand fast (fire still works via the engaged branch)
        this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
      } else if (this.command === 'assault' && this.camp) {
        // push toward the enemy camp, spreading out a little
        toX = this.camp.x - t.x;
        toZ = this.camp.z - t.z;
        const cd = Math.hypot(toX, toZ);
        if (cd > 6) {
          const wob = Math.sin(this.body.handle * 7.3) * 0.18;
          this.body.setLinvel(
            { x: (toX / cd + wob) * this.cls.moveSpeed, y: v.y, z: (toZ / cd + wob) * this.cls.moveSpeed },
            true
          );
        } else {
          this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
        }
      } else if (this.command === 'follow' && this.lowHp) {
        // wounded ally: fall back toward the player instead of standing tall
        toX = leader.x - t.x;
        toZ = leader.z - t.z;
        const dist = Math.hypot(toX, toZ);
        const v = this.body.linvel();
        if (dist > 4) {
          this.body.setLinvel({ x: (toX / dist) * this.cls.moveSpeed * 0.9, y: v.y, z: (toZ / dist) * this.cls.moveSpeed * 0.9 }, true);
        } else {
          this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
        }
      } else if (this.command === 'follow' && this.lastKnown && this.investigateT < 6) {
        // squad tactic: the player fired (or called out) —close on that spot
        // and support instead of hovering at follow distance like a bodyguard
        this.investigateT += dt;
        toX = this.lastKnown.x - t.x;
        toZ = this.lastKnown.z - t.z;
        const dist = Math.hypot(toX, toZ);
        const v = this.body.linvel();
        if (dist > 8) {
          this.body.setLinvel({ x: (toX / dist) * this.cls.moveSpeed, y: v.y, z: (toZ / dist) * this.cls.moveSpeed }, true);
        } else {
          this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
        }
      } else {
        // follow: hold station near the player at follow distance
        toX = leader.x - t.x;
        toZ = leader.z - t.z;
        const dist = Math.hypot(toX, toZ);
        const want = A.followDist + (Math.sin(this.body.handle * 7.3) * 2.4); // spread out a little
        if (dist > want + 1.2) {
          this.body.setLinvel({ x: (toX / dist) * this.cls.moveSpeed, y: v.y, z: (toZ / dist) * this.cls.moveSpeed }, true);
        } else if (dist < want - 2.2) {
          // too close —back off gently so we don't crowd the player
          this.body.setLinvel({ x: (-toX / dist) * this.cls.moveSpeed * 0.5, y: v.y, z: (-toZ / dist) * this.cls.moveSpeed * 0.5 }, true);
        } else {
          this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
        }
      }
    } else if (this.alive && this.side === 'hostile' && this.lastKnown && this.investigateT < 3) {
      // lost the target mid-fight: sweep the last confirmed spot for a moment
      // before falling back —reads as cautious, not omniscient
      this.investigateT += dt;
      const lx = this.lastKnown.x - t.x;
      const lz = this.lastKnown.z - t.z;
      const ld = Math.hypot(lx, lz);
      const v = this.body.linvel();
      if (ld > 1.2) {
        this.body.setLinvel({ x: (lx / ld) * this.cls.moveSpeed * 0.85, y: v.y, z: (lz / ld) * this.cls.moveSpeed * 0.85 }, true);
      } else {
        // arrived: stand and scan (the seeT recheck keeps running)
        this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
        this.investigateT += dt * 2;
      }
    } else if (this.alive && this.side === 'hostile' && this.campPos) {
      // not engaged: pull back toward the camp so hostiles defend their base
      // instead of standing around where they spawned mid-field
      const campDx = this.campPos.x - t.x;
      const campDz = this.campPos.z - t.z;
      const campDist = Math.hypot(campDx, campDz);
      const v = this.body.linvel();
      if (campDist > 14) {
        // jog back toward the camp flag
        this.body.setLinvel({ x: (campDx / campDist) * this.cls.moveSpeed * 0.7, y: v.y, z: (campDz / campDist) * this.cls.moveSpeed * 0.7 }, true);
      } else {
        // inside the perimeter: stand guard (tiny wander keeps them alive-ish)
        const wander = Math.sin(this.body.handle * 11 + performance.now() / 3000) * 0.15;
        this.body.setLinvel({ x: wander * this.cls.moveSpeed, y: v.y, z: 0 }, true);
      }
    } else {
      const v = this.body.linvel();
      this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
    }

    // sync mesh to the physics body
    const tr = this.body.translation();
    const rot = this.body.rotation();
    this.mesh.position.set(tr.x, tr.y, tr.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    // face the foe/leader —applied AFTER the body sync, or the yaw we just
    // set would be clobbered by the (identity, because rotations are locked
    // while alive) body quaternion every frame.
    if (this.alive && this.downed) {
      // wounded: tipped forward and low (the sync above resets from the body
      // every frame, so the pose lives here, not in fallWounded)
      this.mesh.rotation.set(-Math.PI / 2 * 0.88, this.downedYaw, 0);
      this.mesh.position.y = tr.y - 0.55;
    } else if (this.alive) {
      const fx = best && engaged ? best.pos().x - tr.x : leader ? leader.x - tr.x : 0;
      const fz = best && engaged ? best.pos().z - tr.z : leader ? leader.z - tr.z : 0;
      if (fx !== 0 || fz !== 0) {
        this.mesh.rotation.set(0, Math.atan2(fx, fz), 0);
      }
    }

    // --- blocky soldier animation (canonical look) ---
    // Weapon stays in the hands: small arm swing, springy steps, and the gun
    // rises to an aimed stance when a target is actually in sight.
    const lv = this.body.linvel();
    const spd = Math.hypot(lv.x, lv.z);
    // aim stance blends in when engaged, blends back out otherwise
    const aimT = this.alive && engaged && best ? 1 : 0;
    this.aimBlend += (aimT - this.aimBlend) * Math.min(1, dt * 6);
    const ab = this.aimBlend;
    if (this.alive && spd > 0.4) {
      this.walkPhase += dt * (2.0 + spd * 1.6);
      const swing = Math.sin(this.walkPhase) * Math.min(0.5, spd * 0.16);
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      // arms keep the rifle: front arm rides the weapon (nearly rigid), the
      // support arm tucks in as the stance aims —no windmilling swings
      const swingF = Math.sin(this.walkPhase + 0.7) * 0.05 * (1 - ab);
      this.armF.rotation.x = 1.05 + 0.35 * ab + swingF;
      const swingB = Math.sin(this.walkPhase + 2.2) * 0.08 * (1 - ab);
      this.armB.rotation.x = 0.35 - 0.18 * ab + swingB;
      this.gun.position.y = 0.25 + 0.07 * ab + Math.sin(this.walkPhase * 2 + 1.2) * 0.03;
      // springy steps: slight rise/fall + body roll at the double-time beat
      this.pivot.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.03 * (1 - ab * 0.5);
      this.pivot.rotation.z = Math.sin(this.walkPhase * 2) * 0.02;
    } else if (this.alive) {
      // settle back to the idle pose + subtle breathing so standers feel alive
      this.walkPhase = 0;
      this.idlePhase += dt;
      const breathe = Math.sin(this.idlePhase * 1.9) * 0.018;
      this.legL.rotation.x *= 0.8;
      this.legR.rotation.x *= 0.8;
      const k = Math.min(1, dt * 8);
      this.armF.rotation.x += (1.05 + 0.35 * ab + breathe - this.armF.rotation.x) * k;
      this.armB.rotation.x += (0.35 - 0.18 * ab - this.armB.rotation.x) * k;
      this.gun.position.y += (0.25 + 0.07 * ab - this.gun.position.y) * k;
      this.pivot.position.y += (breathe * 0.5 - this.pivot.position.y) * k;
      this.pivot.rotation.z *= 0.85;
    }

    // --- GLB soldier animation state machine ---
    if (this.glbMixer && this.glbRoot) {
      this.glbMixer.update(dt);
      let want = 'Man_Idle';
      if (!this.alive) want = 'Man_Death';
      else if (spd > 2.0) want = 'Man_Run';
      else if (spd > 0.3) want = 'Man_Walk';
      if (want !== this.glbClip) {
        const prev = this.glbAct[this.glbClip];
        if (prev) prev.fadeOut(0.15);
        const act = this.glbAct[want];
        if (act) {
          act.reset();
          act.setLoop(act === this.glbAct['Man_Death'] ? THREE.LoopOnce : THREE.LoopRepeat, 1);
          if (act === this.glbAct['Man_Death']) act.clampWhenFinished = true;
          act.fadeIn(0.15);
          act.play();
        }
        this.glbClip = want;
      }
    }

    // --- tactical aim lock: MUST run AFTER mixer.update —the walk/run clips
    // drive UpperArm/LowerArm tracks and would overwrite the pose each frame
    // (chest-level rifle hold, auto-tuned u=0.6/l=1.4). Dead soldiers unlock
    // so the death animation owns the arms.
    if (this.glbRoot && this.alive) {
      for (const name of ['UpperArmR', 'UpperArmL']) {
        const b = this.glbRoot.getObjectByName(name);
        if (b) b.rotation.set(0.6, 0, 0);
      }
      for (const name of ['LowerArmR', 'LowerArmL']) {
        const b = this.glbRoot.getObjectByName(name);
        if (b) b.rotation.set(1.4, 0, 0);
      }
    }

    // --- rifle orientation: barrel along the soldier's facing, grip down ---
    // recomputed against the live hand-bone quaternion every frame so the
    // weapon stays level while the walk/run animation pumps the arms (also
    // removes the guessed Euler constants that pointed the barrel anywhere)
    if (this.glbRifle && this.glbHand && this.glbRoot && this.alive) {
      this.glbHand.updateWorldMatrix(true, false);
      this.glbHand.getWorldQuaternion(Q_HAND);
      this.glbRoot.getWorldQuaternion(Q_ROOT);
      V_FWD.set(0, 0, 1).applyQuaternion(Q_ROOT); // soldier forward in world
      V_Y.set(0, 1, 0).addScaledVector(V_FWD, -V_FWD.y).normalize();
      V_Z.crossVectors(V_FWD, V_Y).normalize();
      M_BASIS.makeBasis(V_FWD, V_Y, V_Z);
      Q_DESIRED.setFromRotationMatrix(M_BASIS);
      this.glbRifle.quaternion.copy(Q_HAND.invert().multiply(Q_DESIRED));
    }

    // --- hit reaction: brief backward lean that decays ---
    if (this.hitT > 0) this.hitT -= dt;
    const lean = this.alive ? Math.min(0.3, this.hitT * 1.9) : 0;
    this.pivot.rotation.x = -lean;

    // --- muzzle flash decay ---
    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT / 0.07);
      if (this.muzzleSprite) {
        (this.muzzleSprite.material as THREE.SpriteMaterial).opacity = k * 0.95;
        this.muzzleSprite.scale.setScalar(0.18 + k * 0.5);
      }
    } else if (this.muzzleSprite && this.alive) {
      (this.muzzleSprite.material as THREE.SpriteMaterial).opacity = 0;
    }

    // damage flash (emissive intensity, keeps the base class glow)
    if (this.flash > 0 && this.alive) {
      this.flash -= dt;
      const k = Math.max(0, this.flash / 0.12);
      this.matBody.emissiveIntensity = Enemy.EMISSIVE_BASE + k * 1.4;
    } else if (this.flash > 0) {
      this.flash = 0;
    }
  }

  /** Clear line of sight to a target's eye? (walls/hills/cover block it.) */
  /** Squad tactic: flanking allies circle toward the target instead of
   *  closing head-on, so two soldiers never stack in one firing lane. */
  private flankVec(dirX: number, dirZ: number): [number, number] {
    const f = Steering.flankDir(dirX, dirZ, this.flankSide);
    return [f.x, f.z];
  }

  /** A squadmate called out a position: remember it as the last confirmed spot. */
  receiveCall(x: number, z: number) {
    this.lastKnown = { x, z };
    this.investigateT = 0;
  }

  /** Fire a rocket toward the target's current position (leads nothing —
   *  the 22 m/s flight and slight droop make it dodgeable). */
  private launchRocket(target: CombatTarget, physics: PhysicsWorld) {
    if (this.rocket) return; // one in flight
    const eye = this.eye().clone();
    const tp = target.eye();
    const dir = tp.clone().sub(eye).normalize();
    dir.y += 0.05;
    dir.normalize();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.4 })
    );
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.position.copy(eye);
    this.scene.add(mesh);
    this.rocket = {
      mesh,
      pos: eye.clone(),
      vel: dir.multiplyScalar(22),
      dmg: this.cls.damage,
      life: 5,
    };
    this.lastShot = performance.now() / 1000;
    this.audio.playEnemyShot(this.cls.snd);
  }

  /** Push the in-flight rocket; returns true when it exploded this frame. */
  private updateRocket(dt: number, physics: PhysicsWorld, foes: CombatTarget[]): boolean {
    const r = this.rocket;
    if (!r) return false;
    r.life -= dt;
    const step = r.vel.clone().multiplyScalar(dt);
    r.vel.y -= 2.5 * dt; // slight droop keeps long shots honest
    const hit = physics.raycast(
      { x: r.pos.x, y: r.pos.y, z: r.pos.z },
      { x: step.x, y: step.y, z: step.z },
      step.length() + 0.2
    );
    let boomAt: THREE.Vector3 | null = hit
      ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z)
      : null;
    r.pos.add(step);
    // proximity fuse vs soldiers
    if (!boomAt) {
      for (const f of foes) {
        if (!f.alive) continue;
        const fp = f.pos();
        if (Math.hypot(fp.x - r.pos.x, fp.y - r.pos.y, fp.z - r.pos.z) < 1.4) {
          boomAt = new THREE.Vector3(fp.x, fp.y, fp.z);
          break;
        }
      }
    }
    if (!boomAt && r.life <= 0) boomAt = r.pos.clone();
    if (!boomAt) {
      r.mesh.position.copy(r.pos);
      r.mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        r.vel.clone().normalize()
      );
      return false;
    }
    // detonate: splash damage to every soldier in radius (foes of the SHOOTER
    // = the player and his allies —rockets hurt everyone)
    this.hooks_explosion(boomAt, r.dmg, foes);
    this.scene.remove(r.mesh);
    (r.mesh.geometry as THREE.BufferGeometry).dispose();
    this.rocket = null;
    return true;
  }

  /** Splash: damage every combat target within 5m of the blast. */
  private hooks_explosion(at: THREE.Vector3, dmg: number, foes: CombatTarget[]) {
    this.effects.explosion(at);
    this.audio.playExplosion();
    for (const f of foes) {
      if (!f.alive) continue;
      const fp = f.pos();
      const d = Math.hypot(fp.x - at.x, fp.z - at.z);
      if (d < 5) {
        const falloff = Math.max(0.35, 1 - d / 5);
        const dir = new THREE.Vector3(fp.x - at.x, 0.4, fp.z - at.z).normalize();
        f.hurt(Math.round(dmg * falloff), at, dir, this);
      }
    }
  }

  /** Does this ray hit count as hitting the target? The open-top scout car
   *  is transparent to line of sight while someone drives it: you can see and
   *  shoot the driver, and the rounds chew the vehicle instead. */
  private rayHitsTarget(hit: { collider: RAPIER.Collider }, target: CombatTarget): boolean {
    if (hit.collider.handle === target.collider.handle) return true;
    const ud = hit.collider.parent()?.userData as { type?: string; wheeled?: { driver: boolean } } | undefined;
    return !!ud && ud.type === 'wheeled' && !!ud.wheeled?.driver;
  }

  private hasLineTo(target: CombatTarget): boolean {
    const eye = this.eye();
    const tEye = target.eye().clone();
    const dx = tEye.x - eye.x;
    const dy = tEye.y - eye.y;
    const dz = tEye.z - eye.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.4) return true;
    const hit = this.physics.raycast(
      { x: eye.x, y: eye.y, z: eye.z },
      { x: dx / len, y: dy / len, z: dz / len },
      len + 0.3,
      this.collider
    );
    if (!hit) return true; // open ground all the way —nothing blocks the view
    return this.rayHitsTarget(hit, target);
  }
  private shoot(target: CombatTarget, physics: PhysicsWorld) {
    // RPG specialists fire a slow, visible rocket instead of hitscan rounds —
    // the player gets a full second to dodge behind cover.
    if (this.cls.key === 'rpg') {
      this.launchRocket(target, physics);
      return;
    }
    const eye = this.eye().clone(); // shooter eye (fresh copy —cached vector)
    const tEye = target.eye().clone();
    const dir = tEye.clone().sub(eye);
    const len = dir.length();
    dir.normalize();
    // aim error
    const err = this.cls.aimError * this.spreadMul;
    dir.x += (Math.random() - 0.5) * err * 2;
    dir.y += (Math.random() - 0.5) * err * 2;
    dir.z += (Math.random() - 0.5) * err * 2;
    dir.normalize();

    const hit = physics.raycast(
      { x: eye.x, y: eye.y, z: eye.z },
      { x: dir.x, y: dir.y, z: dir.z },
      len + 2,
      this.collider
    );
    if (!hit || !this.rayHitsTarget(hit, target)) {
      // blocked by cover (or an aim miss): stay quiet —no muzzle flash, no
      // report —so AI never advertises its position through a wall. Rounds
      // that strike the driven jeep DO pass this check (they damage it).
      return;
    }

    this.lastShot = performance.now() / 1000;
    this.audio.playEnemyShot(this.cls.snd);
    {
      const t = this.body.translation();
      const pt = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
      const from = new THREE.Vector3(t.x, t.y, t.z);
      target.hurt(this.cls.damage * this.dmgMul, pt, from, this);
    }

    // --- muzzle flash + tracer so incoming fire reads visually at night ---
    this.flashT = 0.07;
    this.mesh.updateMatrixWorld(true);
    const mzWorld = this.muzzleObj ? this.muzzleObj.getWorldPosition(new THREE.Vector3()) : null;
    if (mzWorld && this.effects) {
      this.effects.tracer(mzWorld, tEye);
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    if (this.laser) {
      this.scene.remove(this.laser);
      this.laser.geometry.dispose();
      (this.laser.material as THREE.Material).dispose();
      this.laser = null;
    }
    this.physics.world.removeRigidBody(this.body);
    // Only dispose the per-soldier body clone. Helmet/vest/boot/head come from
    // the shared MaterialCache —disposing them would kill every other soldier.
    this.matBody.dispose();
    this.mesh.traverse((o) => {
      // The muzzle glow is a Sprite: sprites share ONE internal geometry app-
      // wide, so disposing it here would destroy the GPU buffer for every
      // other sprite (fires, plumes, other soldiers). Only its material is
      // per-soldier; leave the shared geometry alone.
      if ((o as THREE.Sprite).isSprite) return;
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      // materials: matBody already disposed; everything else is cache-shared
    });
  }
}

export class EnemyManager {
  private nightHostiles = false;
  private squadCommand: 'follow' | 'assault' | 'hold' = 'follow';
  /** Medkits dropped by dying hostiles (bobbing pickups, 40 HP each). */
  private medkits: Array<{ mesh: THREE.Group; t: number; baseY: number }> = [];
  /** Wired by the game: heals the player and refreshes the health HUD. */
  onResupply: ((amount: number) => void) | null = null;
  /** Wired by the game: spawns a medkit pickup at the dying hostile's spot. */
  onDeath: ((pos: THREE.Vector3) => void) | null = null;
  /** Netplay: the joined player's ghost body —hostiles treat it as a target. */
  remoteTarget: CombatTarget | null = null;
  /** Hostile squad —the "enemy count" that drives missions & killfeed. */
  enemies: Enemy[] = [];
  /** Friendly squad that deploys beside the player. */
  allies: Enemy[] = [];
  private campAnchor: { x: number; z: number } | null = null;
  private dmgMul = 1;
  private hpMul = 1;

  constructor(
    private physics: PhysicsWorld,
    private scene: THREE.Scene,
    private audio: Audio,
    private effects: CombatVfx
  ) {}

  /**
   * Spawn the hostile squad. `camp` is the enemy base (they fall back here);
   * `advanceTo` is a forward point some of them patrol instead (the player's
   * side of the map) so the enemy presses forward rather than squatting.
   */
  spawnHostiles(
    points: THREE.Vector3[],
    camp: { x: number; z: number } | null = null,
    dmgMul = 1,
    hpMul = 1,
    advanceTo: { x: number; z: number } | null = null
  ) {
    // NOTE: no clear here —multi-pronged deployment calls spawnHostiles
    // several times; the caller clears once before the first wave.
    this.campAnchor = camp ? { x: camp.x, z: camp.z } : null;
    this.dmgMul = dmgMul;
    this.hpMul = hpMul;
    const classes = this.pickClassMix(points.length);
    const campVec = camp ? new THREE.Vector3(camp.x, 0, camp.z) : null;
    const advVec = advanceTo ? new THREE.Vector3(advanceTo.x, 0, advanceTo.z) : null;
    points.forEach((p, i) => {
      // first half of the squad patrols toward the player's side
      const anchor = advVec && i < Math.ceil(points.length / 2) ? advVec : campVec;
      const e = new Enemy(this.physics, this.scene, this.audio, this.effects, p, classes[i], 'hostile', anchor);
      e.applyScale(dmgMul, hpMul);
      this.applyNight(e);
      e.onDeath = (p) => this.onDeath?.(p);
      this.enemies.push(e);
    });
  }

  /** Spawn the friendly squad (riflemen, ally side). */
  spawnAllies(points: THREE.Vector3[]) {
    this.clearAllies();
    const [rifle] = CONFIG.enemyClasses;
    points.forEach((p) => {
      const a = new Enemy(
        this.physics, this.scene, this.audio, this.effects, p, rifle, 'ally',
        this.campAnchor ? new THREE.Vector3(this.campAnchor.x, 0, this.campAnchor.z) : null
      );
      a.command = this.squadCommand;
      this.allies.push(a);
    });
  }

  /** Squad command (X key): re-point every living ally at once. */
  setCommand(cmd: 'follow' | 'assault' | 'hold') {
    this.squadCommand = cmd;
    for (const a of this.allies) a.command = cmd;
  }

  get command() {
    return this.squadCommand;
  }

  /** One extra hostile marching in from beyond the camp (reserve pool). */
  spawnReinforce(pos: THREE.Vector3) {
    const [rifle, smg] = CONFIG.enemyClasses;
    const cls = Math.random() < 0.22 ? smg : rifle;
    const anchor = this.campAnchor;
    const e = new Enemy(
      this.physics, this.scene, this.audio, this.effects, pos, cls, 'hostile',
      anchor ? new THREE.Vector3(anchor.x, 0, anchor.z) : null
    );
    e.applyScale(this.dmgMul, this.hpMul);
    this.applyNight(e);
    e.onDeath = (p) => this.onDeath?.(p);
    this.enemies.push(e);
  }

  /** Gunfire / blasts / orders draw idle hostiles: sweep to the noise. */
  /** Spawned hostiles inherit the current night state. */
  private applyNight(e: Enemy) {
    if (this.nightHostiles) {
      e.sightMul = 0.55;
      e.spreadMul = 1.6;
    }
  }

  /** Player gunfire draws nearby allies to support toward the aim point. */
  sharePlayerAim(x: number, z: number, radius: number) {
    for (const a of this.allies) {
      if (!a.alive) continue;
      const t = a.body.translation();
      if (Math.hypot(t.x - x, t.z - z) < radius) a.receiveCall(x, z);
    }
  }

  alertAt(x: number, z: number, radius: number) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const t = e.body.translation();
      if (Math.hypot(t.x - x, t.z - z) < radius) e.wakeTo(x, z);
    }
  }

  /** Balanced squad: mostly riflemen, plus an SMG rusher and a marksman. */
  private pickClassMix(n: number): EnemyClassDef[] {
    const [rifle, smg, marksman, rpg, lmg] = CONFIG.enemyClasses;
    const list: EnemyClassDef[] = [];
    const nSmg = n >= 2 ? 1 : 0;
    const nMarks = n >= 3 ? 1 : 0;
    const nLmg = n >= 4 ? 1 : 0; // suppression specialist
    const nRpg = n >= 5 ? 1 : 0; // rocket specialist shows up in bigger fights
    for (let i = 0; i < nSmg; i++) list.push(smg);
    for (let i = 0; i < nMarks; i++) list.push(marksman);
    for (let i = 0; i < nLmg; i++) list.push(lmg);
    for (let i = 0; i < nRpg; i++) list.push(rpg);
    while (list.length < n) list.push(rifle);
    // shuffle so the mix lands on random ring positions
    for (let i = list.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /** Netplay: register the joined player's ghost as a hostile target. */
  setRemoteTarget(t: CombatTarget) {
    this.remoteTarget = t;
  }

  /** Netplay: ally briefs for the client snapshot (id = ally index). */
  getAlliesSnapshot(): Array<{ id: number; x: number; z: number; hp: number; flags: number }> {
    const out: Array<{ id: number; x: number; z: number; hp: number; flags: number }> = [];
    this.allies.forEach((a, i) => {
      if (!a.alive) return;
      const t = a.body.translation();
      const hp = Math.max(0, Math.round((a as unknown as { health: number }).health));
      out.push({ id: i, x: t.x, z: t.z, hp, flags: a.downed ? 1 : 0 });
    });
    return out;
  }

  clearEnemies() {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    // dropped medkits vanish with the fresh operation
    for (const mk of this.medkits) this.scene.remove(mk.mesh);
    this.medkits.length = 0;
  }

  clearAllies() {
    for (const e of this.allies) e.dispose();
    this.allies = [];
  }
  clear() {
    this.clearEnemies();
    this.clearAllies();
  }

  /** Living hostile count (mission progress, killfeed). */
  aliveCount() {
    return this.enemies.filter((e) => e.alive).length;
  }
  /** Living friendly count (squad status). */
  alliesAlive() {
    // downed soldiers read as LOST until revived (drives the HUD counter and
    // the "we're losing ground" voice) —reviving puts them back in the count
    return this.allies.filter((e) => e.alive && !e.downed).length;
  }

  /** ?debug=1 runtime probe: first soldiers of each side for self-tests. */
  probe() {
    const pick = (arr: Enemy[], n: number) => arr.slice(0, n).map((s) => s.debugInfo());
    return { enemies: pick(this.enemies, 4), allies: pick(this.allies, 2) };
  }

  spawnMedkit(pos: THREE.Vector3) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.3, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.8 })
    );
    box.castShadow = true;
    const cross1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.08, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 })
    );
    cross1.position.set(0, 0.06, 0.18);
    const cross2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.3, 0.06),
      cross1.material
    );
    cross2.position.set(0, 0.06, 0.18);
    g.add(box, cross1, cross2);
    g.position.set(pos.x, pos.y + 0.4, pos.z);
    this.scene.add(g);
    this.medkits.push({ mesh: g, t: Math.random() * 6, baseY: pos.y + 0.4 });
  }

  /** Nearest rescuable (downed, alive) ally within `radius` of a point. */
  nearestDowned(x: number, z: number, radius: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const a of this.allies) {
      if (!a.alive || !a.downed) continue;
      const t = a.body.translation();
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < radius && d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  /**
   * Advance both squads. Hostiles see the player + allies; allies see
   * hostiles and hold station near the player when nothing is in range.
   */
  /**
   * Night-recon state: hostiles see ~45% shorter and fire wilder in the dark,
   * so flanking and silent approach pay off at night. Applies to current and
   * future hostiles (reinforcements included); allies stay unaffected.
   */
  setNight(night: boolean) {
    for (const e of this.enemies) {
      e.sightMul = night ? 0.55 : 1;
      e.spreadMul = night ? 1.6 : 1;
    }
    this.nightHostiles = night;
  }

  update(dt: number, player: Player, damagePlayer: (d: number, source?: THREE.Vector3) => void) {
    // medkit pickups: bob, spin, and get grabbed by the walking player
    for (let i = this.medkits.length - 1; i >= 0; i--) {
      const mk = this.medkits[i];
      mk.t += dt;
      mk.mesh.position.y = mk.baseY + Math.sin(mk.t * 2.2) * 0.09;
      mk.mesh.rotation.y += dt * 1.6;
      const mp = mk.mesh.position;
      const pp = player.pos;
      if (player.alive && Math.hypot(mp.x - pp.x, mp.z - pp.z) < 1.6) {
        this.onResupply?.(40);
        this.scene.remove(mk.mesh);
        this.medkits.splice(i, 1);
      }
    }
    // player wrapper: hostiles hurt the player through the same hook as before
    const playerTarget: CombatTarget = {
      pos: () => player.pos,
      eye: () => player.getEye(),
      collider: player.collider,
      get alive() {
        return player.alive;
      },
      hurt: (d: number, _pt: THREE.Vector3, from: THREE.Vector3) => {
        damagePlayer(d, from);
        return !player.alive;
      },
    };

    // hostiles: foes = player + friendly squad
    if (this.enemies.length) {
      const foes: CombatTarget[] = [playerTarget, ...this.allies];
      // netplay: hostiles also engage the joined player's ghost body
      if (this.remoteTarget && this.remoteTarget.alive) foes.push(this.remoteTarget);
      for (const e of this.enemies) e.update(dt, foes, this.physics, null);
    }
    // allies: foes = hostile squad; leader = player (keep station)
    if (this.allies.length) {
      const foes: CombatTarget[] = this.enemies;
      for (const a of this.allies) a.update(dt, foes, this.physics, player.pos);
    }

    // Distance LOD: far soldiers drop limb meshes (torso silhouette stays).
    {
      const LOD_R2 = 28 * 28;
      const px = player.pos.x;
      const pz = player.pos.z;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const t = e.body.translation();
        e.setLimbLod((t.x - px) * (t.x - px) + (t.z - pz) * (t.z - pz) < LOD_R2);
      }
      for (const a of this.allies) {
        if (!a.alive) continue;
        const t = a.body.translation();
        a.setLimbLod((t.x - px) * (t.x - px) + (t.z - pz) * (t.z - pz) < LOD_R2);
      }
    }

    // --- same-side separation. Every frame each soldier rewrites its own
    // velocity toward a goal, which cancels the physics collision push that
    // would normally keep capsules apart —so squads end up walking through
    // each other. After the AI intent is applied we nudge overlapping
    // same-side pairs sideways (O(n^2) on —2 soldiers is negligible).
    const PUSH_D = 1.1; // personal space while moving
    const pushPair = (a: Enemy, b: Enemy) => {
      const ta = a.body.translation();
      const tb = b.body.translation();
      const sep = Steering.separationDelta(ta.x, ta.z, tb.x, tb.z);
      if (!sep) return;
      const va = a.body.linvel();
      const vb = b.body.linvel();
      a.body.setLinvel({ x: va.x + sep.ax, y: va.y, z: va.z + sep.az }, true);
      b.body.setLinvel({ x: vb.x + sep.bx, y: vb.y, z: vb.z + sep.bz }, true);
    };
    for (let i = 0; i < this.enemies.length; i++) {
      if (!this.enemies[i].alive) continue;
      for (let j = i + 1; j < this.enemies.length; j++) pushPair(this.enemies[i], this.enemies[j]);
    }
    // cull long-dead ragdolls so the battlefield doesn't accumulate bodies
    const now = performance.now();
    const cull = (list: Enemy[]) => {
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].diedAt !== Infinity && now - list[i].diedAt > 25000) {
          list[i].dispose();
          list.splice(i, 1);
        }
      }
    };
    cull(this.enemies);
    cull(this.allies);
    for (let i = 0; i < this.allies.length; i++) {
      const ally = this.allies[i];
      if (!ally.alive) continue;
      for (let j = i + 1; j < this.allies.length; j++) {
        if (this.allies[j].alive) pushPair(ally, this.allies[j]);
      }
      // breathing room off the player too —he's kinematic, so physics alone
      // would just pin allies against his collider while they push forward
      const at = ally.body.translation();
      const dx = at.x - player.pos.x;
      const dz = at.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.85 && d > 0.01) {
        const k = ((0.85 - d) / 0.85) * 1.8;
        const v = ally.body.linvel();
        ally.body.setLinvel({ x: v.x + (dx / d) * k, y: v.y, z: v.z + (dz / d) * k }, true);
      }
    }
  }

  /** Hostiles only —friendly squad is not targetable by player weapons/blasts. */
  getEnemies() {
    return this.enemies;
  }
  getSoldiers() {
    return [...this.enemies, ...this.allies];
  }
}
