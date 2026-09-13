/**
 * ARPG recipe — top-down WASD, melee/ranged attack, drops, score.
 * Opt-in; copy or call with your data.
 */
import * as THREE from 'three';
import { defineGame } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Pool } from '../blocks/Pool';
import { Health } from '../blocks/gameplay/Health';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { Economy } from '../blocks/gameplay/Economy';
import { Cooldown } from '../blocks/combat/Cooldown';
import { pickTarget } from '../blocks/combat/Targeting';
import { Projectile, stepProjectiles } from '../blocks/combat/Projectile';
import { Pickup, PickupField } from '../blocks/interact/Pickup';
import * as Steering from '../blocks/Steering';
import { kitScatter } from '../blocks/kit/placeholders';
import { ButtonBar } from '../blocks/ui/ButtonBar';
import { QuestTracker } from '../blocks/ui/QuestTracker';
import type { System, EngineWorld } from '../engine/types';

export interface ArpgRecipeOpts {
  id: string;
  title?: string;
  playerHp?: number;
  moveSpeed?: number;
  attackRange?: number;
  attackDamage?: number;
  attackCd?: number;
  arena?: number;
  spawnEvery?: number;
  enemyHp?: number;
  enemySpeed?: number;
}

export function createArpgGame(
  opts: ArpgRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const arena = opts.arena ?? 30;
  const moveSpeed = opts.moveSpeed ?? 9;
  const attackRange = opts.attackRange ?? 3.5;
  const attackDamage = opts.attackDamage ?? 20;
  const attackCd = new Cooldown(opts.attackCd ?? 0.45);
  const playerHpMax = opts.playerHp ?? 100;
  const enemyHp = opts.enemyHp ?? 40;
  const enemySpeed = opts.enemySpeed ?? 3.5;
  const spawnEvery = opts.spawnEvery ?? 2.5;

  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 2, arena * 2),
    new THREE.MeshStandardMaterial({ color: 0x4a5a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  root.add(kitScatter(18, arena * 0.85));

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x5b8fd4 }),
  );
  player.position.set(0, 1, 0);
  player.castShadow = true;
  root.add(player);

  const playerHealth = new Health({ max: playerHpMax });
  const score = new Scoreboard();
  const gold = new Economy({ start: 0 });
  const quest = new QuestTracker({ title: '任务' });
  const bar = new ButtonBar({
    onClick: (id) => {
      if (id === 'attack') attack();
    },
  });
  bar.setSlots([{ id: 'attack', label: '攻击', key: '空格/J' }]);
  const KILL_GOAL = 10;
  quest.setItems([{ id: 'k10', title: `击杀 ${KILL_GOAL} 个目标`, done: false }]);

  // optional tiny SFX (no assets required)
  let ac: AudioContext | null = null;
  function beep(freq: number) {
    try {
      if (typeof AudioContext === 'undefined') return;
      ac = ac ?? new AudioContext();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = freq;
      g.gain.value = 0.04;
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.05);
    } catch {
      /* silent */
    }
  }

  interface E {
    mesh: THREE.Mesh;
    health: Health;
    alive: boolean;
  }
  const enemyGeo = new THREE.BoxGeometry(0.9, 1.1, 0.9);
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0xc44 });
  const enemies = new Pool<E>(
    () => {
      const mesh = new THREE.Mesh(enemyGeo, enemyMat);
      mesh.visible = false;
      root.add(mesh);
      return { mesh, health: new Health({ max: 1 }), alive: false };
    },
    (e) => {
      e.alive = false;
      e.mesh.visible = false;
    },
    12,
  );

  const drops = new PickupField();
  const dropGeo = new THREE.SphereGeometry(0.25, 8, 6);
  const dropMat = new THREE.MeshStandardMaterial({ color: 0xffd27a });

  const projGeo = new THREE.SphereGeometry(0.15, 6, 6);
  const projMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
  const projectiles: Projectile[] = [];
  const projMeshes = new Map<Projectile, THREE.Mesh>();

  const keys = new Set<string>();
  let spawnT = 0;
  let t = 0;
  let status: 'playing' | 'lose' = 'playing';
  let hud: HTMLElement | null = null;
  let endEl: HTMLElement | null = null;
  let facingX = 0;
  let facingZ = 1;

  const rig = new CameraRig(camera, {
    defaultMode: 'orbit',
    blend: 0.2,
    orbit: { distance: 28, height: 24, pitch: 0.7 },
  });

  function spawnEnemy() {
    const e = enemies.acquire();
    e.alive = true;
    const ang = Math.random() * Math.PI * 2;
    const r = arena * 0.85;
    e.mesh.position.set(Math.cos(ang) * r, 0.55, Math.sin(ang) * r);
    e.mesh.visible = true;
    e.health = new Health({
      max: enemyHp,
      onDeath: () => {
        e.alive = false;
        enemies.release(e);
        score.addKill();
        gold.add(5);
        beep(1320);
        if (score.kills >= KILL_GOAL) quest.complete('k10');
        // drop
        const id = 'drop' + score.kills;
        const mesh = new THREE.Mesh(dropGeo, dropMat);
        mesh.position.copy(e.mesh.position);
        mesh.position.y = 0.4;
        root.add(mesh);
        drops.add(
          new Pickup({
            id,
            x: e.mesh.position.x,
            z: e.mesh.position.z,
            y: 0.4,
            radius: 1.4,
            onCollect: () => {
              mesh.visible = false;
              gold.add(2);
            },
          }),
        );
      },
    });
  }

  function liveEnemies(): E[] {
    const out: E[] = [];
    enemies.forEachLive((e) => {
      if (e.alive) out.push(e);
    });
    return out;
  }

  function attack() {
    if (!attackCd.tryFire()) return;
    beep(880);
    const list = liveEnemies()
      .filter((e) => e.alive)
      .map((e) => ({
        x: e.mesh.position.x,
        z: e.mesh.position.z,
        alive: true,
        ref: e as E,
      }));
    const target = pickTarget(
      player.position.x,
      player.position.z,
      list,
      undefined,
      { range: attackRange },
    );
    if (target) {
      target.ref.health.damage(attackDamage);
      return;
    }
    // projectile if nothing in melee range
    const p = new Projectile({
      x: player.position.x,
      z: player.position.z,
      dx: facingX,
      dz: facingZ,
      speed: 18,
      damage: attackDamage * 0.6,
      life: 1.2,
      owner: 'player',
    });
    projectiles.push(p);
    const m = new THREE.Mesh(projGeo, projMat);
    m.position.set(p.x, 0.6, p.z);
    root.add(m);
    projMeshes.set(p, m);
  }

  function onKeyDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') attack();
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  function showEnd() {
    if (endEl || typeof document === 'undefined') return;
    status = 'lose';
    endEl = document.createElement('div');
    endEl.style.cssText =
      'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#e07070;font:28px/1.4 system-ui,sans-serif';
    endEl.textContent = '倒下 — 击杀 ' + score.kills;
    document.body.appendChild(endEl);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDn);
    window.addEventListener('keyup', onKeyUp);
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        t += ft;
        if (!world.playing || status !== 'playing') {
          if (hud)
            hud.textContent = `HP ${playerHealth.hp} · 击杀 ${score.kills} · 金 ${gold.balance} [${status}]`;
          return;
        }

        score.tick(ft);
        attackCd.update(ft);
        spawnT -= ft;
        if (spawnT <= 0) {
          spawnT = spawnEvery;
          spawnEnemy();
        }

        let mx = 0;
        let mz = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
        const len = Math.hypot(mx, mz);
        if (len > 0) {
          mx /= len;
          mz /= len;
          facingX = mx;
          facingZ = mz;
          player.position.x = THREE.MathUtils.clamp(
            player.position.x + mx * moveSpeed * ft,
            -arena,
            arena,
          );
          player.position.z = THREE.MathUtils.clamp(
            player.position.z + mz * moveSpeed * ft,
            -arena,
            arena,
          );
        }
        rig.update(ft, player.position, Math.atan2(facingX, facingZ));

        enemies.forEachLive((e) => {
          if (!e.alive) return;
          const dx = player.position.x - e.mesh.position.x;
          const dz = player.position.z - e.mesh.position.z;
          const d = Math.hypot(dx, dz);
          if (d > 1.1) {
            const dir = Steering.normalizeXZ(dx, dz);
            e.mesh.position.x += dir.x * enemySpeed * ft;
            e.mesh.position.z += dir.z * enemySpeed * ft;
          } else if (Math.random() < ft * 0.8) {
            playerHealth.damage(6);
            if (!playerHealth.alive) showEnd();
          }
        });

        drops.update(player.position.x, player.position.z, 0.4);

        const hitTargets = liveEnemies()
          .filter((e) => e.alive)
          .map((e) => ({
            x: e.mesh.position.x,
            z: e.mesh.position.z,
            radius: 0.6,
            alive: true,
            ref: e,
          }));
        const hits = stepProjectiles(projectiles, hitTargets, ft, 0.4);
        for (const h of hits) (h.target as E).health.damage(h.damage);
        for (const [p, m] of projMeshes) {
          if (!p.alive) {
            m.visible = false;
            projMeshes.delete(p);
          } else m.position.set(p.x, 0.6, p.z);
        }

        if (!hud && typeof document !== 'undefined') {
          hud = document.createElement('div');
          hud.id = 'arpg-hud';
          hud.style.cssText =
            'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.5 monospace;background:rgba(0,0,0,.5);padding:10px 14px;border-radius:8px;pointer-events:none;white-space:pre';
          document.body.appendChild(hud);
        }
        if (hud) {
          hud.textContent =
            `HP ${playerHealth.hp}/${playerHpMax} · 击杀 ${score.kills} · 金 ${gold.balance}\n` +
            `WASD 移动 · 空格/J 或底栏「攻击」`;
        }
      },
    },
  ];

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeyDn);
        window.removeEventListener('keyup', onKeyUp);
      }
      scene.remove(root);
      hud?.remove();
      endEl?.remove();
      hud = null;
      endEl = null;
    },
    stats: () => ({ hp: playerHealth.hp, kills: score.kills, gold: gold.balance, status }),
  };
}

export function arpgRecipe(opts: ArpgRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: { default: 'orbit', allow: ['orbit', 'chase'] },
    create: (ctx) => createArpgGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
