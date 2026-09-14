/**
 * ARPG recipe — top-down WASD, melee/ranged attack, AOE skill, drops, score.
 * Opt-in; copy or call with your data.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Pool } from '../blocks/Pool';
import { Health } from '../blocks/gameplay/Health';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { Economy } from '../blocks/gameplay/Economy';
import { RunState } from '../blocks/progress/RunState';
import { XpProgress } from '../blocks/progress/XpProgress';
import { Cooldown } from '../blocks/combat/Cooldown';
import { pickTarget } from '../blocks/combat/Targeting';
import { Projectile, stepProjectiles } from '../blocks/combat/Projectile';
import { areaHits } from '../blocks/combat/AreaDamage';
import { Pickup, PickupField } from '../blocks/interact/Pickup';
import * as Steering from '../blocks/Steering';
import { kitScatter } from '../blocks/kit/placeholders';
import { ButtonBar } from '../blocks/ui/ButtonBar';
import { QuestTracker } from '../blocks/ui/QuestTracker';
import { Inventory } from '../blocks/gameplay/Inventory';
import { InventoryGrid } from '../blocks/ui/InventoryGrid';
import { LootTable } from '../blocks/gameplay/LootTable';
import { HudPanel } from '../blocks/ui/HudPanel';
import { HealthBar } from '../blocks/ui/HealthBar';
import { DamageNumbers } from '../blocks/ui/DamageNumber';
import { WorldBar } from '../blocks/ui/WorldBar';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { BgmLayers } from '../blocks/audio/BgmLayers';
import { KitSfx } from '../blocks/audio/KitSfx';
import { GameFeel } from '../blocks/fx/GameFeel';
import type { System, EngineWorld } from '../engine/types';

export interface ArpgRecipeOpts extends BaseRecipeOpts {
  playerHp?: number;
  moveSpeed?: number;
  attackRange?: number;
  attackDamage?: number;
  attackCd?: number;
  /** AOE skill radius (key 2). */
  aoeRadius?: number;
  aoeDamage?: number;
  aoeCd?: number;
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
  const aoeRadius = opts.aoeRadius ?? 5;
  const aoeDamage = opts.aoeDamage ?? 28;
  const aoeCd = new Cooldown(opts.aoeCd ?? 3);
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
  const run = new RunState();
  const xp = new XpProgress();
  xp.onLevelUp = (lv) => {
    toastLike('升级！Lv' + lv);
  };
  function toastLike(msg: string) {
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);z-index:45;color:#ffd27a;font:700 18px system-ui;pointer-events:none;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
  const quest = new QuestTracker({ title: '任务' });
  const inv = new Inventory({ slots: 18, stackLimit: 9 });
  const invGrid = new InventoryGrid(inv, { id: 'inv-grid' });
  invGrid.hide();
  const loot = new LootTable([
    { id: 'gold_nugget', weight: 70, qty: [1, 3] },
    { id: 'potion', weight: 25, qty: 1 },
    { id: 'gem', weight: 5, qty: 1 },
  ]);
  const bar = new ButtonBar({
    onClick: (id) => {
      if (id === 'attack') attack();
      if (id === 'aoe') aoeSkill();
      if (id === 'inv') invGrid.toggle();
    },
  });
  bar.setSlots([
    { id: 'attack', label: '攻击', key: '空格/J' },
    { id: 'aoe', label: '旋风斩', key: 'K' },
    { id: 'inv', label: '背包', key: 'I' },
  ]);
  const KILL_GOAL = 10;
  const sfx = new KitSfx();
  const feel = new GameFeel();
  const bgm = new BgmLayers();
  let ac: AudioContext | null = null;
  let bgmReady = false;
  function ensureBgm() {
    if (bgmReady || typeof AudioContext === 'undefined') return;
    try {
      ac = ac ?? new AudioContext();
      bgm.attach(ac);
      bgmReady = true;
    } catch {
      /* silent */
    }
  }
  quest.setItems([{ id: 'k10', title: `击杀 ${KILL_GOAL} 个目标`, done: false }]);

  // UI blocks
  const hud = new HudPanel({ id: 'arpg-hud', position: 'tl' });
  const playerBar = new HealthBar({ width: 120, height: 8 });
  if (playerBar.el) {
    playerBar.el.style.cssText += ';position:fixed;left:12px;bottom:12px;z-index:20;';
    document.body.appendChild(playerBar.el);
  }
  const dmgNums = new DamageNumbers();
  const endOverlay = new EndOverlay();
  const enemyBar = new WorldBar({ width: 44, height: 4, color: '#e07070' });
  enemyBar.setVisible(false);

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
  let status: 'playing' | 'win' | 'lose' = 'playing';
  let facingX = 0;
  let facingZ = 1;

  const rig = new CameraRig(camera, {
    defaultMode: 'orbit',
    blend: 0.2,
    orbit: { distance: 28, height: 24, pitch: 0.7 },
  });

  function screenPos(obj: THREE.Object3D): { x: number; y: number } {
    const v = obj.position.clone();
    v.y += 1.2;
    v.project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * (typeof window !== 'undefined' ? window.innerWidth : 800),
      y: (-v.y * 0.5 + 0.5) * (typeof window !== 'undefined' ? window.innerHeight : 600),
    };
  }

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
        run.addKill();
        xp.addXp(12);
        gold.add(5);
        for (const s of loot.roll()) inv.add(s);
        sfx.play('pickup');
        const sp = screenPos(e.mesh);
        dmgNums.spawn(sp.x, sp.y, '击杀', true);
        if (score.kills >= KILL_GOAL) quest.complete('k10');
        if (score.kills >= 12 && status === 'playing') showEnd(true);
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

  function hitEnemy(e: E, amount: number, crit = false) {
    const sp = screenPos(e.mesh);
    dmgNums.spawn(sp.x, sp.y, String(Math.round(amount)), crit);
    e.health.damage(amount);
  }

  function attack() {
    if (!attackCd.tryFire()) return;
    sfx.play('shoot');
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
      hitEnemy(target.ref, attackDamage);
      return;
    }
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

  function aoeSkill() {
    if (!aoeCd.tryFire()) return;
    sfx.play('boom');
    const list = liveEnemies().map((e) => ({
      x: e.mesh.position.x,
      z: e.mesh.position.z,
      alive: e.alive,
      ref: e,
    }));
    const hits = areaHits(player.position.x, player.position.z, aoeRadius, list);
    for (const h of hits) {
      const e = h.target.ref as E;
      if (e.alive) hitEnemy(e, aoeDamage, true);
    }
  }

  function onKeyDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') attack();
    if (e.code === 'KeyK') aoeSkill();
    if (e.code === 'KeyI') invGrid.toggle();
    if (e.code === 'KeyR' && status !== 'playing') restart();
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  function showEnd(win: boolean) {
    if (status !== 'playing') return;
    status = win ? 'win' : 'lose';
    run.set('kills', score.kills);
    sfx.play(win ? 'win' : 'lose');
    endOverlay.show(
      (win ? '胜利！' : '倒下 — ') +
        `击杀 ${score.kills} · ${run.time.toFixed(0)}s — 按 R 再来`,
      win,
    );
  }

  function restart() {
    if (typeof location !== 'undefined') location.reload();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDn);
    window.addEventListener('pointerdown', ensureBgm, { once: true });
    window.addEventListener('keyup', onKeyUp);
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        t += ft;
        if (!world.playing || status !== 'playing') {
          hud.setText(`HP ${playerHealth.hp} · 击杀 ${score.kills} · 金 ${gold.balance} [${status}]`);
          playerBar.setHp(playerHealth.hp, playerHpMax);
          return;
        }

        score.tick(ft);
        run.tick(ft);
        attackCd.update(ft);
        aoeCd.update(ft);
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
        {
          const live = liveEnemies().length;
          bgm.setIntensity(Math.min(1, live / 8));
        }

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
            feel.flashOnce('rgba(255,60,60,0.28)', 150);
            feel.shake(0.08, 0.18);
            if (!playerHealth.alive) showEnd(false);
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
        for (const h of hits) {
          const e = h.target as E;
          if (e.alive) hitEnemy(e, h.damage);
        }
        for (const [p, m] of projMeshes) {
          if (!p.alive) {
            m.visible = false;
            projMeshes.delete(p);
          } else m.position.set(p.x, 0.6, p.z);
        }

        // WorldBar on nearest living enemy
        {
          const live = liveEnemies();
          let nearest: E | null = null;
          let best = Infinity;
          for (const e of live) {
            const d = e.mesh.position.distanceTo(player.position);
            if (d < best) {
              best = d;
              nearest = e;
            }
          }
          if (nearest && best < 20) {
            enemyBar.setVisible(true);
            enemyBar.setRatio(nearest.health.hp / enemyHp);
            enemyBar.update(camera, nearest.mesh.position, 1.4);
          } else {
            enemyBar.setVisible(false);
          }
        }

        playerBar.setHp(playerHealth.hp, playerHpMax);
        const aoeReady = aoeCd.ready ? '就绪' : `${(aoeCd.ratio * aoeCd.duration).toFixed(1)}s`;
        hud.setText(
          `HP ${playerHealth.hp}/${playerHpMax} · 击杀 ${score.kills} · 金 ${gold.balance}\n` +
            `目标击杀 12 · WASD 移动 · 空格/J 攻击 · K 旋风斩(${aoeReady}) · I 背包`,
        );
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
      hud.dispose();
      playerBar.dispose();
      dmgNums.dispose();
      endOverlay.dispose();
      enemyBar.dispose();
      quest.dispose();
      bar.dispose();
      invGrid.dispose();
      bgm.detach();
      sfx.dispose();
      feel.dispose();
    },
    stats: () => ({
      hp: playerHealth.hp,
      kills: score.kills,
      gold: gold.balance,
      status,
      time: run.time,
    }),
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
