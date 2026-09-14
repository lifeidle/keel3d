/**
 * Sports-lite recipe — knock the ball into the goal. Two-color field.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { FactionMap } from '../blocks/gameplay/Faction';
import { HudPanel } from '../blocks/ui/HudPanel';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import type { System, EngineWorld } from '../engine/types';

export interface SportsRecipeOpts extends BaseRecipeOpts {
  winScore?: number;
}

export function createSportsGame(
  opts: SportsRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const winScore = opts.winScore ?? 5;
  const W = 24;
  const H = 16;

  const root = new THREE.Group();
  scene.add(root);
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ color: 0x3f7a3a }),
  );
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  root.add(field);

  const goalMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) {
    const goal = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 4), goalMat);
    goal.position.set((sx * W) / 2, 0.75, 0);
    root.add(goal);
  }

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  ball.position.set(0, 0.45, 0);
  ball.castShadow = true;
  root.add(ball);
  const ballV = new THREE.Vector2(0, 0);

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6ec8ff }),
  );
  player.position.set(-4, 0.7, 0);
  root.add(player);

  const factions = FactionMap.allAgainstAll(['blue', 'red']);
  const score = new Scoreboard();
  let blue = 0;
  let red = 0;
  const hud = new HudPanel({ id: 'sports-hud', position: 'tl' });
  const endOverlay = new EndOverlay();
  const toast = new Toast();
  const GOAL_TARGET = 3;
  let status: 'playing' | 'over' | 'win' | 'lose' = 'playing';
  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.2, orbit: { distance: 22, height: 16, pitch: 0.75 } });

  function resetBall() {
    ball.position.set(0, 0.45, 0);
    ballV.set(0, 0);
    player.position.set(-4, 0.7, 0);
  }

  const keys = new Set<string>();
  function onDn(e: KeyboardEvent) {
    if (e.code === 'KeyR' && status !== 'playing' && typeof location !== 'undefined') location.reload();
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
          score.tick(ft);
          let mx = 0;
          let mz = 0;
          if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
          if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
          if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
          if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
          const len = Math.hypot(mx, mz) || 1;
          player.position.x = THREE.MathUtils.clamp(player.position.x + (mx / len) * 8 * ft, -W / 2, W / 2);
          player.position.z = THREE.MathUtils.clamp(player.position.z + (mz / len) * 8 * ft, -H / 2, H / 2);

          // kick
          const d = player.position.distanceTo(ball.position);
          if (d < 1.2 && (keys.has('Space') || Math.hypot(mx, mz) > 0.1)) {
            const dx = ball.position.x - player.position.x;
            const dz = ball.position.z - player.position.z;
            const dd = Math.hypot(dx, dz) || 1;
            ballV.x += (dx / dd) * 10 * ft * 60;
            ballV.y += (dz / dd) * 10 * ft * 60;
          }

          ball.position.x += ballV.x * ft;
          ball.position.z += ballV.y * ft;
          ballV.multiplyScalar(Math.pow(0.98, ft * 60));
          if (Math.abs(ball.position.z) > H / 2 - 0.45) ballV.y *= -0.7;

          // goals
          if (ball.position.x > W / 2 - 0.5 && Math.abs(ball.position.z) < 2) {
            blue++;
            toast.show('蓝方进球');
            resetBall();
          } else if (ball.position.x < -W / 2 + 0.5 && Math.abs(ball.position.z) < 2) {
            red++;
            toast.show('红方进球');
            resetBall();
          }
          ball.position.x = THREE.MathUtils.clamp(ball.position.x, -W / 2 + 0.2, W / 2 - 0.2);

          if (blue >= winScore || red >= winScore) {
            status = 'lose';
            endOverlay.show(`${blue > red ? '蓝' : '红'}方胜利 ${blue}:${red}`, blue > red);
          }
          void factions;
        }
        rig.update(ft, ball.position, 0.5);
        hud.setText(
          `目标 ${GOAL_TARGET} 球 · 蓝 ${blue} : ${red} 红 · 用时 ${score.time.toFixed(0)}s\nWASD 移动 · 靠近球推射 · 先到 ${GOAL_TARGET} 球 · R 重开`,
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
      scene.remove(root);
      hud.dispose();
      endOverlay.dispose();
      toast.dispose();
    },
    stats: () => ({ blue, red, status }),
  };
}

export function sportsRecipe(opts: SportsRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: 'orbit',
    create: (ctx) => createSportsGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
