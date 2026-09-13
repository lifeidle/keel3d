/**
 * FPS-arena recipe — minimal first-person skeleton using framework blocks.
 * Independent of the full nightraid demo.
 */
import * as THREE from 'three';
import { defineGame } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Pool } from '../blocks/Pool';
import { Cooldown } from '../blocks/combat/Cooldown';
import { pickTarget } from '../blocks/combat/Targeting';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { kitHumanoid } from '../blocks/kit/placeholders';
import type { System, EngineWorld } from '../engine/types';

export interface FpsArenaOpts {
  id: string;
  title?: string;
  moveSpeed?: number;
  lookSpeed?: number;
  fireCd?: number;
  bulletDamage?: number;
  targetHp?: number;
  spawnEvery?: number;
  arena?: number;
  eyeHeight?: number;
}

export function createFpsArena(
  opts: FpsArenaOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const moveSpeed = opts.moveSpeed ?? 7;
  const lookSpeed = opts.lookSpeed ?? 2.2;
  const fireCd = new Cooldown(opts.fireCd ?? 0.2);
  const bulletDamage = opts.bulletDamage ?? 25;
  const targetHp = opts.targetHp ?? 50;
  const spawnEvery = opts.spawnEvery ?? 2.5;
  const arena = opts.arena ?? 30;
  const eye = opts.eyeHeight ?? 1.65;

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
  }
  const targets = new Pool<T>(
    () => {
      const g = kitHumanoid(0xc44a4a);
      g.visible = false;
      root.add(g);
      return { root: g, hp: 0, alive: false };
    },
    (t) => {
      t.alive = false;
      t.root.visible = false;
    },
    8,
  );

  const score = new Scoreboard();
  const keys = new Set<string>();
  let yaw = 0;
  let pitch = 0;
  let spawnT = 1;
  let t = 0;
  let hud: HTMLElement | null = null;
  const rig = new CameraRig(camera, { defaultMode: 'fps', blend: 0 });

  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') shoot();
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

  function shoot() {
    if (!fireCd.tryFire()) return;
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
    // simple facing filter via minDot
    const target = pickTarget(playerPos.x, playerPos.z, list, undefined, {
      range: 40,
      facingX: fx,
      facingZ: fz,
      minDot: 0.35,
    });
    if (target && 'ref' in target) {
      const tg = (target as { ref: T }).ref;
      tg.hp -= bulletDamage;
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
    const ang = Math.random() * Math.PI * 2;
    const r = arena * 0.5 + Math.random() * arena * 0.35;
    x.root.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    x.root.visible = true;
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        t += ft;
        if (world.playing) {
          fireCd.update(ft);
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
            // move relative to yaw
            const s = Math.sin(yaw);
            const c = Math.cos(yaw);
            playerPos.x += (mx * c + mz * s) * moveSpeed * ft;
            playerPos.z += (-mx * s + mz * c) * moveSpeed * ft;
            playerPos.x = THREE.MathUtils.clamp(playerPos.x, -arena, arena);
            playerPos.z = THREE.MathUtils.clamp(playerPos.z, -arena, arena);
          }
          // arrow look fallback
          if (keys.has('ArrowLeft')) yaw += lookSpeed * ft;
          if (keys.has('ArrowRight')) yaw -= lookSpeed * ft;
          if (keys.has('ArrowUp')) pitch = Math.min(1.2, pitch + lookSpeed * 0.7 * ft);
          if (keys.has('ArrowDown')) pitch = Math.max(-1.2, pitch - lookSpeed * 0.7 * ft);

          camera.position.copy(playerPos);
          camera.rotation.order = 'YXZ';
          camera.rotation.set(pitch, yaw, 0);
        }

        if (!hud && typeof document !== 'undefined') {
          hud = document.createElement('div');
          hud.id = 'fps-arena-hud';
          hud.style.cssText =
            'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.5 monospace;background:rgba(0,0,0,.5);padding:10px 14px;border-radius:8px;pointer-events:none;white-space:pre';
          document.body.appendChild(hud);
        }
        if (hud) {
          hud.textContent =
            `FPS 骨架 · 击杀 ${score.kills} · 目标 ${targets.activeCount}\n` +
            `WASD 移动 · 鼠标/方向键转向 · 空格/J 射击（点击画面锁定指针）`;
        }
        void rig;
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
      hud?.remove();
      cross?.remove();
      hud = null;
      cross = null;
    },
    stats: () => ({ kills: score.kills, targets: targets.activeCount }),
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
