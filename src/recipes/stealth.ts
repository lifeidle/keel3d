/**
 * Stealth recipe — avoid guard vision cones, reach the exit.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { PhysicsWorld } from '../physics/world';
import { CharacterController } from '../blocks/player/CharacterController';
import { CameraRig } from '../blocks/CameraRig';
import { canSee } from '../blocks/ai/VisionCone';
import { NoiseEmitter } from '../blocks/ai/NoiseEmitter';
import { TriggerZone } from '../blocks/interact/TriggerZone';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { HudPanel } from '../blocks/ui/HudPanel';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import { GameFeel } from '../blocks/fx/GameFeel';
import { KitSfx } from '../blocks/audio/KitSfx';
import { WorldBar } from '../blocks/ui/WorldBar';
import { PauseMenu } from '../blocks/ui/PauseMenu';
import { ControlsOverlay } from '../blocks/ui/ControlsOverlay';
import type { System, EngineWorld } from '../engine/types';

export interface StealthRecipeOpts extends BaseRecipeOpts {
  moveSpeed?: number;
  guards?: number;
  arena?: number;
}

export function createStealthGame(
  opts: StealthRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const arena = opts.arena ?? 20;
  const nGuards = opts.guards ?? 3;

  const physics = new PhysicsWorld({ gravity: -22, fixedDt: 1 / 60, groundSize: arena + 5, floorDepth: 15 });
  physics.addSafetyFloor();
  physics.addStaticBox({ x: 0, y: -0.5, z: 0 }, { x: arena + 2, y: 0.5, z: arena + 2 });

  const root = new THREE.Group();
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 2, arena * 2),
    new THREE.MeshStandardMaterial({ color: 0x2a3a2a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const player = new CharacterController(physics, {
    speed: opts.moveSpeed ?? 5.5,
    height: 1.6,
    radius: 0.32,
    spawn: new THREE.Vector3(-arena * 0.6, 0.1, 0),
  });
  const avatar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6ec8ff }),
  );
  root.add(avatar);
  player.setMesh(avatar);

  interface G {
    mesh: THREE.Mesh;
    x: number;
    z: number;
    yaw: number;
    phase: number;
    alert: number;
  }
  const guards: G[] = [];
  for (let i = 0; i < nGuards; i++) {
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xe0a050 }),
    );
    const x = (i - (nGuards - 1) / 2) * 6;
    const z = arena * 0.3;
    mesh.position.set(x, 1, z);
    root.add(mesh);
    guards.push({ mesh, x, z, yaw: 0, phase: i * 1.7, alert: 0 });
  }

  const noise = new NoiseEmitter();
  noise.on((e) => {
    for (const g of guards) {
      if (NoiseEmitter.inRadius(e, g.x, g.z)) g.alert = 1;
    }
  });

  const exit = new TriggerZone({
    shape: { kind: 'sphere', x: arena * 0.7, z: 0, radius: 2.2 },
  });

  const score = new Scoreboard();
  const hud = new HudPanel({ id: 'stealth-hud', position: 'tl' });
  const endOverlay = new EndOverlay();
  const toast = new Toast();
  const feel = new GameFeel();
  const sfx = new KitSfx();
  const alertBar = new WorldBar({ width: 40, height: 4, color: '#e0a050' });
  const rig = new CameraRig(camera, { defaultMode: 'shoulder', blend: 0.12, shoulder: { distance: 5, height: 2.2, side: 0.5, lookAhead: 8 } });

  let status: 'playing' | 'win' | 'lose' = 'playing';
  const pause = new PauseMenu({
    active: () => status === 'playing',
  });
  const controls = new ControlsOverlay({
    hints: [
      { keys: ['W', 'A', 'S', 'D'], label: '移动' },
      { keys: ['鼠标'], label: '转向' },
      { keys: ['空格'], label: '发出噪声' },
      { keys: ['Esc'], label: '暂停' },
    ],
    footer: '桌面设备体验更佳',
    duration: 6,
  });
  let seenT = 0;
  const keys = new Set<string>();
  let yaw = 0;
  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (pause.paused) return;
    if (e.code === 'Space') noise.emit(player.position.x, player.position.z, 8, 'step');
    if (e.code === 'KeyR' && status !== 'playing' && typeof location !== 'undefined') location.reload();
  }
  function onUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function onMove(e: MouseEvent) {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      yaw -= e.movementX * 0.0022;
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

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (world.playing && status === 'playing' && !pause.paused) {
          score.tick(ft);
          let mx = 0;
          let mz = 0;
          if (keys.has('KeyW')) mz -= 1;
          if (keys.has('KeyS')) mz += 1;
          if (keys.has('KeyA')) mx -= 1;
          if (keys.has('KeyD')) mx += 1;
          player.update(ft, { moveX: mx, moveZ: mz, jump: false }, yaw);
          physics.step();
          player.syncFromPhysics();

          let anySee = false;
          guards.forEach((g, i) => {
            g.phase += ft * 0.6;
            g.yaw = Math.sin(g.phase) * 1.2 + i;
            g.mesh.rotation.y = g.yaw;
            const sees = canSee(g.x, g.z, g.yaw, player.position.x, player.position.z, {
              fov: Math.PI / 2.2,
              range: 14,
            });
            if (sees) {
              anySee = true;
              g.alert = Math.min(1, g.alert + ft * 0.8);
            } else {
              g.alert = Math.max(0, g.alert - ft * 0.4);
            }
            (g.mesh.material as THREE.MeshStandardMaterial).emissive?.setHex(
              g.alert > 0.5 ? 0x552200 : 0x000000,
            );
          });
          if (anySee) {
            seenT += ft;
            if (seenT > 2.2) {
              status = 'lose';
              endOverlay.show('被发现', false);
            }
          } else {
            seenT = Math.max(0, seenT - ft * 0.5);
          }

          exit.update([{ tag: 'p', x: player.position.x, z: player.position.z }]);
          if (exit.has('p')) {
            status = 'win';
            endOverlay.show(`潜入成功 · ${score.time.toFixed(1)}s`, true);
            toast.show('抵达出口');
          }

          const top = guards.reduce((a, g) => Math.max(a, g.alert), 0);
          alertBar.setVisible(top > 0.05);
          if (top > 0.05) alertBar.setRatio(top);
          alertBar.update(camera, avatar.position, 2);
        }
        const eye = player.position.clone();
        eye.y += 1.2;
        rig.update(ft, eye, yaw);
        hud.setText(
          `目标抵达出口 · 警戒 ${seenT > 0 ? '⚠' : '安全'} · ${score.time.toFixed(0)}s\n` +
            `WASD 移动 · 鼠标转向 · 空格 发出噪声 · 躲开橙色守卫`,
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
      player.dispose();
      scene.remove(root);
      hud.dispose();
      endOverlay.dispose();
      toast.dispose();
      feel.dispose();
      sfx.dispose();
      alertBar.dispose();
      pause.dispose();
      controls.dispose();
    },
    stats: () => ({ status, time: score.time, seenT }),
  };
}

export function stealthRecipe(opts: StealthRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: false,
    autoPlay: true,
    camera: { default: 'shoulder', allow: ['shoulder', 'chase'] },
    create: (ctx) => createStealthGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
