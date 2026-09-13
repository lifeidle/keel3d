/**
 * Wave-survival recipe — survive N waves in an open-ish arena.
 * Opt-in; copy or call with your data.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Pool } from '../blocks/Pool';
import { Health } from '../blocks/gameplay/Health';
import { Economy } from '../blocks/gameplay/Economy';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { WaveDirector, type WaveDef } from '../blocks/gameplay/WaveDirector';
import { Spawner } from '../blocks/gameplay/Spawner';
import { Timers } from '../blocks/gameplay/Timers';
import * as Steering from '../blocks/Steering';
import { HudPanel } from '../blocks/ui/HudPanel';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import type { System, EngineWorld } from '../engine/types';

export interface SurvivalRecipeOpts extends BaseRecipeOpts {
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
  const hud = new HudPanel({ id: 'survival-hud', position: 'tl' });
  const endOverlay = new EndOverlay();
  const timers = new Timers();

  interface E {
    mesh: THREE.Mesh;
    cd: number;
  }
  const enemyGeo = new THREE.BoxGeometry(0.9, 1.1, 0.9);
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0xb85c2a });
  const meshPool = new Pool<E>(
    () => {
      const mesh = new THREE.Mesh(enemyGeo, enemyMat);
      mesh.visible = false;
      root.add(mesh);
      return { mesh, cd: 0 };
    },
    (e) => {
      e.mesh.visible = false;
    },
    12,
  );

  // Spawner owns unit table + HP bookkeeping; meshPool owns meshes
  const spawner = new Spawner<E>({
    table: { beast: { hp: enemyHp, speed: enemySpeed } },
    create: (_key, row) => {
      const e = meshPool.acquire();
      e.cd = 0;
      const ang = Math.random() * Math.PI * 2;
      const r = arena * 0.85;
      e.mesh.position.set(Math.cos(ang) * r, 0.55, Math.sin(ang) * r);
      e.mesh.visible = true;
      void row;
      return e;
    },
    destroy: (e) => {
      meshPool.release(e);
    },
    onDeath: () => {
      eco.add(5);
      score.addKill();
    },
  });

  let status: 'playing' | 'win' | 'lose' = 'playing';
  let t = 0;

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
      const u = spawner.spawn('beast');
      if (u) {
        // scale HP with wave (table row stays the base; unit hp gets the bonus)
        u.hp = (u.row.hp ?? enemyHp) + director.waveNumber * 5;
      }
    },
  });

  // slow health regen every 4s while alive (proves Timers)
  timers.every(4, () => {
    if (status === 'playing' && playerHealth.alive && playerHealth.hp < playerHealth.max) {
      playerHealth.heal(4);
    }
  });

  function showEnd(win: boolean) {
    if (status !== 'playing') return;
    status = win ? 'win' : 'lose';
    endOverlay.show(win ? '生还 — 波次清空' : '陨落', win);
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
        timers.update(ft);
        if (!world.playing || status !== 'playing') {
          hud.setText(`HP ${playerHealth.hp}/${playerHealth.max} · 击杀 ${score.kills} [${status}]`);
          return;
        }

        score.tick(ft);
        director.update(ft);

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

        for (const u of spawner.units) {
          if (!u.alive) continue;
          const e = u.handle;
          const dx = player.position.x - e.mesh.position.x;
          const dz = player.position.z - e.mesh.position.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.05) {
            const dir = Steering.normalizeXZ(dx, dz);
            const step = Math.min(d, (u.row.speed ?? enemySpeed) * ft);
            e.mesh.position.x += dir.x * step;
            e.mesh.position.z += dir.z * step;
          }
          e.cd -= ft;
          if (d < contactRange && e.cd <= 0) {
            e.cd = 0.8;
            playerHealth.damage(contactDamage);
            if (!playerHealth.alive) showEnd(false);
          }
        }
        spawner.reap();

        if (director.finished && spawner.aliveCount === 0 && playerHealth.alive) {
          showEnd(true);
        }

        hud.setText(
          `HP ${playerHealth.hp}/${playerHealth.max} · 击杀 ${score.kills} · 波次 ${director.waveNumber}/${director.totalWaves}\n` +
            `场上 ${spawner.aliveCount} · WASD 移动`,
        );
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
      spawner.clear();
      scene.remove(root);
      hud.dispose();
      endOverlay.dispose();
      timers.clear();
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
