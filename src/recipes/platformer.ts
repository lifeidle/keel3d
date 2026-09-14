/**
 * Platformer recipe — jump between platforms to the goal flag.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { PhysicsWorld } from '../physics/world';
import { CharacterController } from '../blocks/player/CharacterController';
import { CameraRig } from '../blocks/CameraRig';
import { TriggerZone } from '../blocks/interact/TriggerZone';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { HudPanel } from '../blocks/ui/HudPanel';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import type { System, EngineWorld } from '../engine/types';

export interface PlatformerRecipeOpts extends BaseRecipeOpts {
  moveSpeed?: number;
  jumpSpeed?: number;
  platforms?: number;
}

export function createPlatformerGame(
  opts: PlatformerRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const moveSpeed = opts.moveSpeed ?? 7;
  const jumpSpeed = opts.jumpSpeed ?? 11;
  const nPlat = opts.platforms ?? 6;

  const physics = new PhysicsWorld({ gravity: -28, fixedDt: 1 / 60, groundSize: 40, floorDepth: 30 });
  physics.addSafetyFloor();

  const root = new THREE.Group();
  scene.add(root);

  const platMat = new THREE.MeshStandardMaterial({ color: 0x4a6a8a });
  const goalMat = new THREE.MeshStandardMaterial({ color: 0xc4a35a, emissive: 0x332200 });
  const plats: THREE.Vector3[] = [];
  for (let i = 0; i < nPlat; i++) {
    const x = i * 6;
    const y = i * 1.2;
    const z = Math.sin(i) * 2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 4), platMat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    root.add(mesh);
    physics.addStaticBox({ x, y, z }, { x: 2, y: 0.3, z: 2 });
    plats.push(new THREE.Vector3(x, y + 0.3, z));
  }
  const last = plats[plats.length - 1];
  const goal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2, 12), goalMat);
  goal.position.set(last.x, last.y + 1.2, last.z);
  root.add(goal);

  const player = new CharacterController(physics, {
    speed: moveSpeed,
    jumpSpeed,
    height: 1.4,
    radius: 0.3,
    extraGravity: 18,
    spawn: new THREE.Vector3(0, 1.5, 0),
  });
  const avatar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6ec8ff }),
  );
  root.add(avatar);
  player.setMesh(avatar);

  const score = new Scoreboard();
  const hud = new HudPanel({ id: 'plat-hud', position: 'tl' });
  const endOverlay = new EndOverlay();
  const toast = new Toast();
  const rig = new CameraRig(camera, { defaultMode: 'chase', blend: 0.15, chase: { distance: 10, height: 4, lookAhead: 2 } });

  const exit = new TriggerZone({
    shape: { kind: 'sphere', x: last.x, z: last.z, radius: 2 },
  });

  let status: 'playing' | 'win' | 'lose' = 'playing';
  let bestY = 0;
  const keys = new Set<string>();
  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
  }
  function onUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDn);
    window.addEventListener('keyup', onUp);
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (world.playing && status === 'playing') {
          let mx = 0;
          let mz = 0;
          if (keys.has('KeyW') || keys.has('ArrowUp') || keys.has('ArrowRight')) mz -= 1;
          if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
          if (keys.has('KeyA')) mx -= 1;
          if (keys.has('KeyD')) mx += 1;
          const jump = keys.has('Space') || keys.has('ShiftLeft');
          // side-ish view: move along +X primarily
          player.update(
            ft,
            { moveX: mx * 0.3 - mz, moveZ: mx, jump },
            0,
          );
          physics.step();
          player.syncFromPhysics();

          if (player.position.y > bestY) {
            bestY = player.position.y;
            score.add('height', 1);
          }
          if (player.position.y < -8) {
            status = 'lose';
            endOverlay.show('坠落 — 再试一次', false);
          }
          exit.update([{ tag: 'p', x: player.position.x, z: player.position.z }]);
          if (exit.has('p') && status === 'playing') {
            status = 'win';
            endOverlay.show(`登顶！用时 ${score.time.toFixed(1)}s`, true);
            toast.show('到达终点');
          }
          score.tick(ft);
        }
        rig.update(ft, player.position, 0);
        hud.setText(
          `平台 · 高度 ${bestY.toFixed(1)} · 用时 ${score.time.toFixed(1)}s\n` +
            `WASD 移动 · 空格/Shift 跳跃`,
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
      }
      player.dispose();
      scene.remove(root);
      hud.dispose();
      endOverlay.dispose();
      toast.dispose();
    },
    stats: () => ({ status, bestY, time: score.time }),
  };
}

export function platformerRecipe(opts: PlatformerRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: { default: 'chase', allow: ['chase', 'orbit'] },
    create: (ctx) => createPlatformerGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
