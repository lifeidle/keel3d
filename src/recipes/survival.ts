/**
 * Wave-survival recipe — survive N waves in an open-ish arena.
 * Opt-in; copy or call with your data.
 */
import * as THREE from 'three';
import { defineGame } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Pool } from '../blocks/Pool';
import { Health } from '../blocks/gameplay/Health';
import { Economy } from '../blocks/gameplay/Economy';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { WaveDirector, type WaveDef } from '../blocks/gameplay/WaveDirector';
import * as Steering from '../blocks/Steering';
import type { System, EngineWorld } from '../engine/types';

export interface SurvivalRecipeOpts {
  id: string;
  title?: string;
  /** Player max hp. */
  playerHp?: number;
  /** Move speed (units/s) while WASD held. */
  moveSpeed?: number;
  waves?: WaveDef[];
  enemyHp?: number;
  enemySpeed?: number;
  /** Melee damage when enemy is close. */
  contactDamage?: number;
  contactRange?: number;
  arena?: number;
  groundColor?: number;
}

function defaultWaves(): WaveDef[] {
  return [0, 1, 2, 3, 4].map((i) => ({
    count: 4 + i * 2,
    interval: 0.7,
    delay: i === 0 ? 3 : 5,
    unit: 'beast',
  }));
}

export function createSurvivalGame(
  opts: SurvivalRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const arena = opts.arena ?? 40;
  const playerHp = opts.playerHp ?? 100;
  const moveSpeed = opts.moveSpeed ?? 8;
  const enemyHp = opts.enemyHp ?? 25;
  const enemySpeed = opts.enemySpeed ?? 3.2;
  const contactDamage = opts.contactDamage ?? 8;
  const contactRange = opts.contactRange ?? 1.4;

  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 2, arena * 2),
    new THREE.MeshStandardMaterial({ color: opts.groundColor ?? 0x5a8f4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.0, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x5b8fd4 }),
  );
  player.position.set(0, 1, 0);
  player.castShadow = true;
  root.add(player);

  const playerHealth = new Health({ max: playerHp });
  const eco = new Economy({ start: 0 });
  const score = new Scoreboard();

  interface E {
    mesh: THREE.Mesh;
    alive: boolean;
    health: Health;
    cd: number;
  }
  const enemyGeo = new THREE.BoxGeometry(0.9, 1.1, 0.9);
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0xb85c2a });
  const enemies = new Pool<E>(
    () => {
      const mesh = new THREE.Mesh(enemyGeo, enemyMat);
      mesh.visible = false;
      root.add(mesh);
      return { mesh, alive: false, health: new Health({ max: 1 }), cd: 0 };
    },
    (e) => {
      e.alive = false;
      e.mesh.visible = false;
    },
    12,
  );

  let status: 'playing' | 'win' | 'lose' = 'playing';
  let t = 0;
  let hud: HTMLElement | null = null;
  let endEl: HTMLElement | null = null;

  const keys = new Set<string>();
  function onKeyDn(e: KeyboardEvent) {
    keys.add(e.code);
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  const director = new WaveDirector({
    waves: opts.waves ?? defaultWaves(),
    spawnFn: () => {
      const e = enemies.acquire();
      e.alive = true;
      e.cd = 0;
      const ang = Math.random() * Math.PI * 2;
      const r = arena * 0.85;
      e.mesh.position.set(Math.cos(ang) * r, 0.55, Math.sin(ang) * r);
      e.mesh.visible = true;
      e.health = new Health({
        max: enemyHp + director.waveNumber * 5,
        onDeath: () => {
          e.alive = false;
          enemies.release(e);
          eco.add(5);
          score.addKill();
        },
      });
    },
  });

  function ensureHud() {
    if (hud || typeof document === 'undefined') return;
    hud = document.createElement('div');
    hud.id = 'survival-hud';
    hud.style.cssText =
      'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.5 monospace;background:rgba(0,0,0,.5);padding:10px 14px;border-radius:8px;pointer-events:none;white-space:pre';
    document.body.appendChild(hud);
  }

  function showEnd(win: boolean) {
    if (endEl || typeof document === 'undefined') return;
    status = win ? 'win' : 'lose';
    endEl = document.createElement('div');
    endEl.style.cssText =
      'position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font:28px/1.4 system-ui,sans-serif;pointer-events:none;color:#fff';
    endEl.textContent = win ? '生还 — 波次清空' : '陨落';
    endEl.style.color = win ? '#5dcea0' : '#e07070';
    document.body.appendChild(endEl);
  }

  const rig = new CameraRig(camera, {
    defaultMode: 'chase',
    blend: 0.2,
    chase: { distance: 10, height: 5, lookAhead: 2 },
  });

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        t += ft;
        if (!world.playing || status !== 'playing') {
          ensureHud();
          if (hud)
            hud.textContent = `HP ${playerHealth.hp}/${playerHealth.max} · 击杀 ${score.kills} [${status}]`;
          return;
        }

        score.tick(ft);
        director.update(ft);

        // WASD move on XZ
        let mx = 0;
        let mz = 0;
        if (keys.has('KeyW')) mz -= 1;
        if (keys.has('KeyS')) mz += 1;
        if (keys.has('KeyA')) mx -= 1;
        if (keys.has('KeyD')) mx += 1;
        const len = Math.hypot(mx, mz);
        if (len > 0) {
          mx /= len;
          mz /= len;
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
        const yaw = Math.atan2(mx, mz) || t * 0.05;
        rig.update(ft, player.position, yaw);

        enemies.forEachLive((e) => {
          if (!e.alive) return;
          const dx = player.position.x - e.mesh.position.x;
          const dz = player.position.z - e.mesh.position.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.05) {
            const dir = Steering.normalizeXZ(dx, dz);
            const step = Math.min(d, enemySpeed * ft);
            e.mesh.position.x += dir.x * step;
            e.mesh.position.z += dir.z * step;
          }
          e.cd -= ft;
          if (d < contactRange && e.cd <= 0) {
            e.cd = 0.8;
            playerHealth.damage(contactDamage);
            if (!playerHealth.alive) showEnd(false);
          }
        });

        if (director.finished && enemies.activeCount === 0 && playerHealth.alive) {
          showEnd(true);
        }

        ensureHud();
        if (hud) {
          hud.textContent =
            `HP ${playerHealth.hp}/${playerHealth.max} · 击杀 ${score.kills} · 波次 ${director.waveNumber}/${director.totalWaves}\n` +
            `场上 ${enemies.activeCount} · WASD 移动`;
        }
      },
    },
  ];

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDn);
    window.addEventListener('keyup', onKeyUp);
  }

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
    stats: () => ({
      hp: playerHealth.hp,
      kills: score.kills,
      wave: director.waveNumber,
      status,
    }),
  };
}

export function survivalRecipe(opts: SurvivalRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: { default: 'chase', allow: ['chase', 'orbit'] },
    create: (ctx) => createSurvivalGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
