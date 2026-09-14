/**
 * TPS recipe — third-person shoulder camera, character controller, hitscan.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { PhysicsWorld } from '../physics/world';
import { CharacterController } from '../blocks/player/CharacterController';
import { Gamepad } from '../blocks/input/Gamepad';
import { CameraRig } from '../blocks/CameraRig';
import { Arsenal } from '../blocks/combat/Arsenal';
import { pickTarget } from '../blocks/combat/Targeting';
import { Pool } from '../blocks/Pool';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { Health } from '../blocks/gameplay/Health';
import { kitHumanoid } from '../blocks/kit/placeholders';
import { HudPanel } from '../blocks/ui/HudPanel';
import { HealthBar } from '../blocks/ui/HealthBar';
import { DamageNumbers } from '../blocks/ui/DamageNumber';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import type { System, EngineWorld } from '../engine/types';

export interface TpsRecipeOpts extends BaseRecipeOpts {
  moveSpeed?: number;
  sprintMul?: number;
  jumpSpeed?: number;
  lookSpeed?: number;
  bulletDamage?: number;
  targetHp?: number;
  playerHp?: number;
  spawnEvery?: number;
  arena?: number;
  magSize?: number;
  reserve?: number;
  fireRate?: number;
}

export function createTpsGame(
  opts: TpsRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const arena = opts.arena ?? 28;
  const moveSpeed = opts.moveSpeed ?? 6.5;
  const lookSpeed = opts.lookSpeed ?? 2.4;
  const bulletDamage = opts.bulletDamage ?? 22;
  const targetHp = opts.targetHp ?? 40;
  const playerHpMax = opts.playerHp ?? 100;
  const spawnEvery = opts.spawnEvery ?? 2.8;

  const physics = new PhysicsWorld({ gravity: -22, fixedDt: 1 / 60, groundSize: arena + 10, floorDepth: 20 });
  physics.addSafetyFloor();
  physics.addStaticBox({ x: 0, y: -0.5, z: 0 }, { x: arena + 5, y: 0.5, z: arena + 5 });

  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 2, arena * 2),
    new THREE.MeshStandardMaterial({ color: 0x4a5a48 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // cover blocks
  for (let i = 0; i < 8; i++) {
    const w = 1.5 + (i % 3);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, 1.2, w * 0.6),
      new THREE.MeshStandardMaterial({ color: 0x5a5a52 }),
    );
    const ang = (i / 8) * Math.PI * 2;
    const r = arena * 0.45;
    box.position.set(Math.cos(ang) * r, 0.6, Math.sin(ang) * r);
    box.castShadow = true;
    root.add(box);
    physics.addStaticBox(
      { x: box.position.x, y: 0.6, z: box.position.z },
      { x: w / 2, y: 0.6, z: (w * 0.6) / 2 },
    );
  }

  const player = new CharacterController(physics, {
    speed: moveSpeed,
    sprintMul: opts.sprintMul ?? 1.6,
    jumpSpeed: opts.jumpSpeed ?? 8,
    height: 1.7,
    radius: 0.35,
    tag: 'player',
  });
  const avatar = kitHumanoid(0x5b8fd4);
  root.add(avatar);
  player.setMesh(avatar);

  const arsenal = new Arsenal([
    {
      key: 'rifle',
      magSize: opts.magSize ?? 24,
      reserve: opts.reserve ?? 72,
      reloadTime: 1.4,
      fireRate: opts.fireRate ?? 5,
      auto: true,
    },
  ]);

  const playerHealth = new Health({ max: playerHpMax });
  const score = new Scoreboard();
  const hud = new HudPanel({ id: 'tps-hud', position: 'tl' });
  const hpBar = new HealthBar({ width: 130, height: 8 });
  if (hpBar.el) {
    hpBar.el.style.cssText += ';position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:20;';
    document.body.appendChild(hpBar.el);
  }
  const dmgNums = new DamageNumbers();
  const endOverlay = new EndOverlay();
  const pad = new Gamepad();

  const rig = new CameraRig(camera, {
    defaultMode: 'shoulder',
    blend: 0.12,
    shoulder: { distance: 4.2, height: 1.55, side: 0.7, lookAhead: 10 },
  });

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

  let status: 'playing' | 'lose' = 'playing';
  let yaw = Math.PI;
  let pitch = 0;
  let spawnT = 1.2;
  let fireClicked = false;
  const keys = new Set<string>();

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
      yaw -= e.movementX * 0.0024;
      pitch = Math.max(-0.9, Math.min(0.6, pitch - e.movementY * 0.0024));
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

  function hitscan() {
    const list = targets.units
      .filter((x) => x.alive)
      .map((x) => ({ x: x.root.position.x, z: x.root.position.z, alive: true as boolean | undefined, ref: x }));
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const target = pickTarget(player.position.x, player.position.z, list, undefined, {
      range: 36,
      facingX: fx,
      facingZ: fz,
      minDot: 0.4,
    });
    if (target && 'ref' in target) {
      const tg = (target as { ref: T }).ref;
      tg.hp -= bulletDamage;
      const v = tg.root.position.clone();
      v.y += 1.5;
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
    x.fireT = 2 + Math.random();
    const ang = Math.random() * Math.PI * 2;
    const r = arena * 0.55 + Math.random() * arena * 0.3;
    x.root.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    x.root.visible = true;
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        pad.poll();
        const fireHeld = keys.has('Space') || keys.has('KeyJ') || pad.fire;
        if (world.playing && status === 'playing') {
          // look
          yaw += pad.lookX * lookSpeed * ft;
          pitch = Math.max(-0.9, Math.min(0.6, pitch - pad.lookY * lookSpeed * 0.7 * ft));
          if (keys.has('ArrowLeft')) yaw += lookSpeed * ft;
          if (keys.has('ArrowRight')) yaw -= lookSpeed * ft;

          let mx = 0;
          let mz = 0;
          if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
          if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
          if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
          if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
          mx += pad.moveX;
          mz += pad.moveY;
          mx = Math.max(-1, Math.min(1, mx));
          mz = Math.max(-1, Math.min(1, mz));

          // Space / J / RT fires; jump is Shift/Ctrl or gamepad A
          const jump = keys.has('ShiftLeft') || keys.has('ControlLeft') || pad.btn('a');
          player.update(
            ft,
            {
              moveX: mx,
              moveZ: mz,
              jump,
              sprint: keys.has('ShiftRight') || pad.btn('lb'),
            },
            yaw,
          );

          const outcome = arsenal.update(ft, fireHeld, fireClicked);
          if (outcome === 'fired') hitscan();
          fireClicked = false;

          score.tick(ft);
          spawnT -= ft;
          if (spawnT <= 0) {
            spawnT = spawnEvery;
            spawnTarget();
          }

          targets.units.forEach((tg) => {
            if (!tg.alive) return;
            const d = tg.root.position.distanceTo(player.position);
            if (d > 24) return;
            tg.fireT -= ft;
            if (tg.fireT <= 0) {
              tg.fireT = 2.2 + Math.random();
              playerHealth.damage(7);
              if (!playerHealth.alive) {
                status = 'lose';
                endOverlay.show(`倒下 — 击杀 ${score.kills}`, false);
              }
            }
          });
        } else {
          fireClicked = false;
        }

        // step physics after intent
        if (world.playing && status === 'playing') {
          physics.step();
          player.syncFromPhysics();
        }

        const eye = player.position.clone();
        eye.y += player.eyeHeight * 0.5;
        rig.update(ft, eye, yaw);
        if (typeof document !== 'undefined' && document.pointerLockElement) {
          camera.rotation.order = 'YXZ';
          camera.rotation.set(pitch, yaw, 0);
        }

        hpBar.setHp(playerHealth.hp, playerHpMax);
        const ammo = arsenal.reloading ? '换弹中…' : `${arsenal.mag}/${arsenal.reserve}`;
        hud.setText(
          `TPS · 击杀 ${score.kills} · 目标 ${targets.activeCount} · HP ${playerHealth.hp}\n` +
            `弹药 ${ammo} · WASD 移动 · Shift/Ctrl 跳 · 空格/J 或 RT 射击 · R 换弹 · 手柄 A 跳`,
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
      player.dispose();
      scene.remove(root);
      hud.dispose();
      hpBar.dispose();
      dmgNums.dispose();
      endOverlay.dispose();
    },
    stats: () => ({
      kills: score.kills,
      hp: playerHealth.hp,
      status,
      grounded: player.grounded,
      pad: pad.connected,
    }),
  };
}

export function tpsRecipe(opts: TpsRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: { default: 'shoulder', allow: ['shoulder', 'chase', 'orbit'] },
    create: (ctx) => createTpsGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
