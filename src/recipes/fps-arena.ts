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
import { KitSfx } from '../blocks/audio/KitSfx';
import { GameFeel } from '../blocks/fx/GameFeel';
import { Gamepad } from '../blocks/input/Gamepad';
import { TouchControls, isTouchDevice } from '../blocks/input/TouchControls';
import { PauseMenu } from '../blocks/ui/PauseMenu';
import { ControlsOverlay } from '../blocks/ui/ControlsOverlay';
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
  const sfx = new KitSfx();
  const feel = new GameFeel();
  const KILL_GOAL = 15;
  let status: 'playing' | 'win' | 'lose' = 'playing';
  const pad = new Gamepad();

  // Touch channel — phones/tablets only. On these devices the click-to-lock
  // handler below is skipped; look comes from the touch surface instead.
  const touchDevice = isTouchDevice();
  const touchMove = { x: 0, z: 0 };
  let touchFire = false;

  const keys = new Set<string>();
  let yaw = 0;
  let pitch = 0;
  let spawnT = 1;
  let fireClicked = false;

  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') fireClicked = true;
    if (e.code === 'KeyR' && status !== 'playing') {
      if (typeof location !== 'undefined') location.reload();
    } else if (e.code === 'KeyR') {
      if (arsenal.reload()) sfx.play('reload');
    }
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
    if (touchDevice) return; // touch devices never hold the pointer lock
    const el = document.getElementById('app') ?? document.body;
    (el as HTMLElement & { requestPointerLock?: () => void }).requestPointerLock?.();
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDn);
    window.addEventListener('keyup', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);
  }

  let touch: TouchControls | null = null;
  if (touchDevice) {
    touch = new TouchControls(
      {
        setMove: (x, z) => {
          touchMove.x = x;
          touchMove.z = z;
        },
        addLook: (dx, dy) => {
          yaw -= dx * 0.0022;
          pitch = Math.max(-1.2, Math.min(1.2, pitch - dy * 0.0022));
        },
        setFire: (down) => {
          touchFire = down;
        },
      },
      [
        {
          id: 'fire',
          label: 'FIRE',
          kind: 'hold',
          size: 84,
          onDown: () => {
            touchFire = true;
          },
          onUp: () => {
            touchFire = false;
          },
        },
        {
          id: 'reload',
          label: 'RELOAD',
          kind: 'tap',
          size: 56,
          onDown: () => {
            if (arsenal.reload()) sfx.play('reload');
          },
          onUp: () => {},
        },
      ],
    );
    touch.show();
  }
  const pause = new PauseMenu({
    title: 'FPS 骨架',
    active: () => status === 'playing',
    onToggle: (p) => {
      if (!touch) return;
      if (p) touch.hide();
      else touch.show();
    },
  });
  const controls = new ControlsOverlay({
    title: 'FPS 骨架',
    hints: [
      { keys: ['W', 'A', 'S', 'D'], label: '移动' },
      { keys: ['鼠标'], label: '视角' },
      { keys: ['空格', 'J'], label: '射击' },
      { keys: ['R'], label: '换弹' },
      { keys: ['Esc'], label: '暂停' },
    ],
    duration: 6,
  });

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
        pad.poll();
        const fireHeld = keys.has('Space') || keys.has('KeyJ') || touchFire || pad.fire;
        if (world.playing && status === 'playing' && !pause.paused) {
          const outcome = arsenal.update(ft, fireHeld, fireClicked);
          if (outcome === 'fired') { sfx.play('shoot'); hitscan(); }
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
          // Sign conventions differ between the two analog sources:
          // - touch stick is forward-POSITIVE (z: +1 = pushed up), while this
          //   recipe's mz is forward-NEGATIVE (KeyW -> mz -= 1), so subtract.
          // - gamepad axes[1] is already -1 when pushed up, so add directly.
          mx += touchMove.x + pad.moveX;
          mz += -touchMove.z + pad.moveY;
          const len = Math.hypot(mx, mz);
          if (len > 0) {
            if (len > 1) {
              mx /= len;
              mz /= len;
            }
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
          // yaw decreases when turning right (mouse movementX and ArrowRight
          // both subtract), so the right stick must subtract too.
          yaw -= pad.lookX * lookSpeed * ft;
          pitch = Math.max(-1.2, Math.min(1.2, pitch - pad.lookY * lookSpeed * 0.7 * ft));

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
              feel.flashOnce('rgba(255,60,60,0.28)', 150);
              feel.shake(0.1, 0.2);
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
            `目标 ${KILL_GOAL} · 弹药 ${ammo} · WASD 移动 · 空格/J 射击 · R 换弹`,
        );
      },
    },
    pause.system,
    controls.system,
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
      feel.dispose();
      sfx.dispose();
      pause.dispose();
      controls.dispose();
      touch?.dispose();
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
