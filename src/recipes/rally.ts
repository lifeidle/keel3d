/**
 * Rally recipe — loop track with checkpoints + best lap (localStorage).
 */
import * as THREE from 'three';
import { defineGame } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Path } from '../blocks/Path';
import { TriggerZone } from '../blocks/interact/TriggerZone';
import { BestScoreSlot } from '../blocks/progress/SaveSlot';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import type { System, EngineWorld } from '../engine/types';

export interface RallyRecipeOpts {
  id: string;
  title?: string;
  speed?: number;
  checkpoints?: number;
}

export function createRallyGame(
  opts: RallyRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const speed = opts.speed ?? 14;
  const nCp = opts.checkpoints ?? 4;

  const TRACK = new Path([
    { x: -22, y: 0, z: -14 },
    { x: 22, y: 0, z: -14 },
    { x: 26, y: 0, z: 14 },
    { x: -26, y: 0, z: 14 },
    { x: -22, y: 0, z: -14 },
  ]);

  const root = new THREE.Group();
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    new THREE.MeshStandardMaterial({ color: 0x5a7a48 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const car = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 3.4),
    new THREE.MeshStandardMaterial({ color: 0xe05050, metalness: 0.3 }),
  );
  car.position.y = 0.45;
  car.castShadow = true;
  root.add(car);

  const pos = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 0 };
  for (let d = 0; d <= TRACK.totalLen; d += 3) {
    TRACK.sampleAt(d, pos);
    TRACK.sampleDir(d, dir);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.1, 2.8),
      new THREE.MeshStandardMaterial({ color: 0x444444 }),
    );
    slab.position.set(pos.x, 0.05, pos.z);
    slab.rotation.y = Math.atan2(dir.x, dir.z);
    slab.receiveShadow = true;
    root.add(slab);
  }

  // checkpoints along path
  const cps: TriggerZone[] = [];
  for (let i = 0; i < nCp; i++) {
    const t = ((i + 1) / (nCp + 1)) * TRACK.totalLen;
    TRACK.sampleAt(t, pos);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.12, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x6ec8ff }),
    );
    ring.position.set(pos.x, 1.2, pos.z);
    ring.rotation.y = Math.PI / 2;
    root.add(ring);
    cps.push(
      new TriggerZone({
        id: 'cp' + i,
        shape: { kind: 'sphere', x: pos.x, z: pos.z, radius: 2.2 },
      }),
    );
  }

  const best = new BestScoreSlot('keel3d-rally-best');
  const score = new Scoreboard();
  let dist = 0;
  let lapT = 0;
  let nextCp = 0;
  let lap = 0;
  let hud: HTMLElement | null = null;
  const rig = new CameraRig(camera, { defaultMode: 'chase', chase: { distance: 9, height: 3.5, lookAhead: 3 } });

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (world.playing) {
          const prev = dist;
          dist = (dist + speed * ft) % TRACK.totalLen;
          lapT += ft;
          score.tick(ft);
          // checkpoint gates (in order)
          const gate = ((nextCp + 1) / (nCp + 1)) * TRACK.totalLen;
          // crossed if we wrapped or passed gate this frame
          const passed =
            (prev < gate && dist >= gate) || (prev > dist && gate > prev) || (prev > dist && gate <= dist);
          if (passed && nextCp < nCp) {
            nextCp++;
            score.add('cp', 1);
          }
          if (dist < prev) {
            // lap wrap
            if (nextCp >= nCp) {
              lap++;
              best.submit(Math.round(lapT * 100) / 100, 'bestLap', true);
            }
            nextCp = 0;
            lapT = 0;
          }
        }
        TRACK.sampleAt(dist, pos);
        TRACK.sampleDir(dist, dir);
        car.position.set(pos.x, 0.45, pos.z);
        car.rotation.y = Math.atan2(dir.x, dir.z);
        rig.update(ft, car.position, car.rotation.y);

        if (!hud && typeof document !== 'undefined') {
          hud = document.createElement('div');
          hud.id = 'rally-hud';
          hud.style.cssText =
            'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.5 monospace;background:rgba(0,0,0,.5);padding:10px 14px;border-radius:8px;pointer-events:none;white-space:pre';
          document.body.appendChild(hud);
        }
        if (hud) {
          const b = best.read('bestLap');
          hud.textContent =
            `圈 ${lap} · 检查点 ${nextCp}/${nCp} · 用时 ${lapT.toFixed(1)}s\n` +
            `最佳圈 ${b == null ? '—' : b + 's'} · 按顺序穿过光圈才算完整圈`;
        }
      },
    },
  ];

  return {
    systems,
    dispose() {
      scene.remove(root);
      hud?.remove();
    },
    stats: () => ({ lap, cp: nextCp, best: best.read('bestLap') }),
  };
}

export function rallyRecipe(opts: RallyRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: { default: 'chase', allow: ['chase', 'orbit'] },
    create: (ctx) => createRallyGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
