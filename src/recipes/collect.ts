/**
 * Collect recipe — gather N targets in an arena; win when complete.
 */
import * as THREE from 'three';
import { defineGame } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Pickup, PickupField } from '../blocks/interact/Pickup';
import { TriggerZone } from '../blocks/interact/TriggerZone';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import type { System, EngineWorld } from '../engine/types';

export interface CollectRecipeOpts {
  id: string;
  title?: string;
  /** How many orbs to place. */
  count?: number;
  arena?: number;
  /** Seconds target; optional. */
  parTime?: number;
  moveSpeed?: number;
}

export function createCollectGame(
  opts: CollectRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const n = opts.count ?? 8;
  const arena = opts.arena ?? 28;
  const moveSpeed = opts.moveSpeed ?? 10;

  const root = new THREE.Group();
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 2, arena * 2),
    new THREE.MeshStandardMaterial({ color: 0x3d6b4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6ec8ff }),
  );
  player.position.set(0, 1, 0);
  root.add(player);

  const home = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2.2, 0.3, 20),
    new THREE.MeshStandardMaterial({ color: 0xc4a35a }),
  );
  home.position.set(0, 0.15, 0);
  root.add(home);

  const geo = new THREE.SphereGeometry(0.4, 10, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0x554400 });
  const field = new PickupField();
  const orbMeshes: THREE.Mesh[] = [];
  let got = 0;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const r = arena * (0.45 + (i % 3) * 0.15);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.7, z);
    root.add(mesh);
    field.add(
      new Pickup({
        id: 'orb' + i,
        x,
        z,
        y: 0.7,
        radius: 1.8,
        onCollect: () => {
          got++;
          mesh.visible = false;
        },
      }),
    );
  }

  const zone = new TriggerZone({
    shape: { kind: 'sphere', x: 0, z: 0, radius: 2.5 },
  });
  const score = new Scoreboard();
  const keys = new Set<string>();
  let status: 'playing' | 'win' = 'playing';
  let hud: HTMLElement | null = null;
  let endEl: HTMLElement | null = null;
  const rig = new CameraRig(camera, { defaultMode: 'chase', chase: { distance: 12, height: 6, lookAhead: 2 } });

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
        if (!world.playing || status !== 'playing') {
          if (hud) hud.textContent = `收集 ${got}/${n} [${status}]`;
          return;
        }
        score.tick(ft);
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
          player.position.x = THREE.MathUtils.clamp(player.position.x + mx * moveSpeed * ft, -arena, arena);
          player.position.z = THREE.MathUtils.clamp(player.position.z + mz * moveSpeed * ft, -arena, arena);
        }
        rig.update(ft, player.position, Math.atan2(mx, mz) || 0);
        field.update(player.position.x, player.position.z, 0.7);
        zone.update([{ tag: 'p', x: player.position.x, z: player.position.z }]);

        if (got >= n && zone.has('p')) {
          status = 'win';
          if (typeof document !== 'undefined' && !endEl) {
            endEl = document.createElement('div');
            endEl.style.cssText =
              'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);color:#5dcea0;font:28px/1.4 system-ui,sans-serif';
            endEl.textContent = `收集完成 · ${score.time.toFixed(1)}s — 回到金圈交付`;
            document.body.appendChild(endEl);
          }
        }

        if (!hud && typeof document !== 'undefined') {
          hud = document.createElement('div');
          hud.id = 'collect-hud';
          hud.style.cssText =
            'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.5 monospace;background:rgba(0,0,0,.5);padding:10px 14px;border-radius:8px;pointer-events:none;white-space:pre';
          document.body.appendChild(hud);
        }
        if (hud) {
          hud.textContent =
            `收集 ${got}/${n} · 时间 ${score.time.toFixed(1)}s\n` +
            `WASD 移动 · 捡满回金圈 · R 重开`;
        }
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
      hud?.remove();
      endEl?.remove();
    },
    stats: () => ({ got, n, status, time: score.time }),
  };
}

export function collectRecipe(opts: CollectRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: { default: 'chase', allow: ['chase', 'orbit'] },
    create: (ctx) => createCollectGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
