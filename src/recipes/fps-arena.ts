/**
 * FPS-arena recipe — minimal first-person skeleton using framework blocks.
 * Independent of the full nightraid demo.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { Pool } from '../blocks/Pool';
import { Arsenal } from '../blocks/combat/Arsenal';
import { pickTarget } from '../blocks/combat/Targeting';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { Health } from '../blocks/gameplay/Health';
import { kitHumanoid } from '../blocks/kit/placeholders';
import { HudPanel } from '../blocks/ui/HudPanel';
import { HealthBar } from '../blocks/ui/HealthBar';
import { DamageNumbers } from '../blocks/ui/DamageNumber';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import type { System, EngineWorld } from '../engine/types';

export interface FpsArenaOpts extends BaseRecipeOpts {
  moveSpeed?: number;
  lookSpeed?: number;
  bulletDamage?: number;
  targetHp?: number;
  playerHp?: number;
  spawnEvery?: number;
  arena?: number;
  eyeHeight?: number;
  magSize?: number;
  reserve?: number;
  reloadTime?: number;
  fireRate?: number;
}

export function createFpsArena(
  opts: FpsArenaOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const moveSpeed = opts.moveSpeed ?? 7;
  const lookSpeed = opts.lookSpeed ?? 2.2;
  const bulletDamage = opts.bulletDamage ?? 25;
  const targetHp = opts.targetHp ?? 50;
  const playerHpMax = opts.playerHp ?? 100;
  const spawnEvery = opts.spawnEvery ?? 2.5;
  const arena = opts.arena ?? 30;
  const eye = opts.eyeHeight ?? 1.65;

  const arsenal = new Arsenal([
    {
      key: 'carbine',
      magSize: opts.magSize ?? 24,
      reserve: opts.reserve ?? 72,
      reloadTime: opts.reloadTime ?? 1.4,
      fireRate: opts.fireRate ?? 6,
      auto: false,
    },
  ]);

  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 2, arena * 2),
    new THREE.MeshStandardMaterial({ color: 0x4a5a48 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // simple crosshair
  let cross: HTMLElement | null = null;
  if (typeof document !== 'undefined') {
    cross = document.createElement('div');
    cross.style.cssText =
      'position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#fff;z-index:25;pointer-events:none;opacity:.85';
    document.body.appendChild(cross);
  }

  interface T {
    root: THREE.Group;
    hp: number;
    alive: boolean;
    fireT: number;
  }
  const targets = new Pool<T>(
    () => {
      const g = kitHumanoid(0xc44a4a);
      g.visible = false;
      root.add(g);
      return { root: g, hp: 0, alive: false, fireT: 0 };
    },
    (t) => {
      t.alive = false;
      t.root.visible = false;
    },
    8,
  );

  const score = new Scoreboard();
  const playerHealth = new Health({ max: playerHpMax });
  const hud = new HudPanel({ id: 'fps-arena-hud', position: 'tl' });
  const hpBar = new HealthBar({ width: 140, height: 8 });
  if (hpBar.el) {
    hpBar.el.style.cssText += ';position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:20;';
    document.body.appendChild(hpBar.el);
  }
  const dmgNums = new DamageNumbers();
  const endOverlay = new EndOverlay();
  let status: 'playing' | 'lose' = 'playing';

  const keys = new Set<string>();
  let yaw = 0;
  let pitch = 0;
  let spawnT = 1;
  let fireClicked = false;

  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') fireClicked = true;
    if (e.code === 'KeyR') arsenal.reload();
  }
  function onUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function onMove(e: MouseEvent) {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      yaw -= e.movementX * 0.0022;
      pitch -= e.movementY * 0.0022;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
    }
  }
  function onClick() {
    const el = document.getElementById('app') ?? document.body;
    (el as HTMLElement & { requestPointerLock?: () => void }).requestPointerLock?.();
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDn);
    window.addEventListener('keyup', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);
  }

  const playerPos = new THREE.Vector3(0, eye, 0);

  function hitscan() {
    const list = targets.units
      .filter((x) => x.alive)
      .map((x) => ({
        x: x.root.position.x,
        z: x.root.position.z,
        alive: true as boolean | undefined,
        ref: x,
      }));
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const target = pickTarget(playerPos.x, playerPos.z, list, undefined, {
      range: 40,
      facingX: fx,
      facingZ: fz,
      minDot: 0.35,
    });
    if (target && 'ref' in target) {
      const tg = (target as { ref: T }).ref;
      tg.hp -= bulletDamage;
      const v = tg.root.position.clone();
      v.y += 1.6;
      v.project(camera);
      const sx = (v.x * 0.5 + 0.5) * (typeof window !== 'undefined' ? window.innerWidth : 800);
      const sy = (-v.y * 0.5 + 0.5) * (typeof window !== 'undefined' ? window.innerHeight : 600);
      dmgNums.spawn(sx, sy, String(bulletDamage));
      if (tg.hp <= 0) {
        tg.alive = false;
        targets.release(tg);
        score.addKill();
      }
    }
  }

  function spawnTarget() {
    const x = targets.acquire();
    x.alive = true;
    x.hp = targetHp;
    x.fireT = 1.5 + Math.random();
    const ang = Math.random() * Math.PI * 2;
    const r = arena * 0.5 + Math.random() * arena * 0.35;
    x.root.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    x.root.visible = true;
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        const fireHeld = keys.has('Space') || keys.has('KeyJ');
        if (world.playing && status === 'playing') {
          const outcome = arsenal.update(ft, fireHeld, fireClicked);
          if (outcome === 'fired') hitscan();
          fireClicked = false;

          score.tick(ft);
          spawnT -= ft;
          if (spawnT <= 0) {
            spawnT = spawnEvery;
            spawnTarget();
          }
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
            const s = Math.sin(yaw);
            const c = Math.cos(yaw);
            playerPos.x += (mx * c + mz * s) * moveSpeed * ft;
            playerPos.z += (-mx * s + mz * c) * moveSpeed * ft;
            playerPos.x = THREE.MathUtils.clamp(playerPos.x, -arena, arena);
            playerPos.z = THREE.MathUtils.clamp(playerPos.z, -arena, arena);
          }
          if (keys.has('ArrowLeft')) yaw += lookSpeed * ft;
          if (keys.has('ArrowRight')) yaw -= lookSpeed * ft;
          if (keys.has('ArrowUp')) pitch = Math.min(1.2, pitch + lookSpeed * 0.7 * ft);
          if (keys.has('ArrowDown')) pitch = Math.max(-1.2, pitch - lookSpeed * 0.7 * ft);

          camera.position.copy(playerPos);
          camera.rotation.order = 'YXZ';
          camera.rotation.set(pitch, yaw, 0);

          targets.units.forEach((tg) => {
            if (!tg.alive) return;
            const d = tg.root.position.distanceTo(playerPos);
            if (d > 22) return;
            tg.fireT -= ft;
            if (tg.fireT <= 0) {
              tg.fireT = 2 + Math.random();
              playerHealth.damage(8);
              if (!playerHealth.alive) {
                status = 'lose';
                endOverlay.show(`倒下 — 击杀 ${score.kills}`, false);
              }
            }
          });
        } else {
          fireClicked = false;
        }

        hpBar.setHp(playerHealth.hp, playerHpMax);
        const ammo = arsenal.reloading
          ? '换弹中…'
          : `${arsenal.mag}/${arsenal.reserve}`;
        hud.setText(
          `FPS 骨架 · 击杀 ${score.kills} · 目标 ${targets.activeCount} · HP ${playerHealth.hp}\n` +
            `弹药 ${ammo} · WASD 移动 · 空格/J 射击 · R 换弹（点击画面锁定指针）`,
        );
      },
    },
  ];

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onDn);
        window.removeEventListener('keyup', onUp);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('click', onClick);
      }
      scene.remove(root);
      hud.dispose();
      hpBar.dispose();
      dmgNums.dispose();
      endOverlay.dispose();
      cross?.remove();
      cross = null;
    },
    stats: () => ({
      kills: score.kills,
      targets: targets.activeCount,
      hp: playerHealth.hp,
      status,
      mag: arsenal.mag,
      reserve: arsenal.reserve,
    }),
  };
}

export function fpsArenaRecipe(opts: FpsArenaOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: 'fps',
    create: (ctx) => createFpsArena(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
