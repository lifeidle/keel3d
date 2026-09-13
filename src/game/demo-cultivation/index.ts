/**
 * Sample C — demo-cultivation (open world, multi-camera).
 * Independent content package: must NOT import nightraid or demo-tower.
 * Phase E skeleton: stream chunks placeholder + chase default + key switch.
 */
import * as THREE from 'three';
import { defineGame } from '../../content/defineGame';
import { CameraRig, type CameraMode } from '../../blocks/CameraRig';
import type { System, EngineWorld } from '../../engine/types';

export interface CultivationDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

/** 2×2 chunk placeholders around origin. */
export function createCultivationGame(deps: CultivationDeps) {
  const { scene, camera } = deps;
  const root = new THREE.Group();
  scene.add(root);

  const chunk = 40;
  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -1; cz <= 1; cz++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(chunk * 0.95, chunk * 0.95),
        new THREE.MeshStandardMaterial({
          color: (cx + cz) % 2 === 0 ? 0x2f4a32 : 0x3a5640,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx * chunk, 0, cz * chunk);
      root.add(m);
    }
  }

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.0, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xd4c4a8 }),
  );
  player.position.set(0, 1, 0);
  root.add(player);

  const rig = new CameraRig(camera, { defaultMode: 'chase', blend: 0.2 });
  let mode: CameraMode = 'chase';
  let realm = '炼气';
  let progress = 0;
  let t = 0;
  let hudEl: HTMLElement | null = null;

  function setMode(m: CameraMode) {
    mode = m;
    rig.setMode(m);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === '1') setMode('fps');
    else if (e.key === '2') setMode('chase');
    else if (e.key === '3') setMode('orbit');
  }

  function ensureHud() {
    if (hudEl || typeof document === 'undefined') return;
    hudEl = document.createElement('div');
    hudEl.id = 'cultivation-hud';
    hudEl.style.cssText =
      'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.4 monospace;background:rgba(0,0,0,.45);padding:8px 12px;border-radius:6px;pointer-events:none';
    document.body.appendChild(hudEl);
  }

  const systems: System[] = [
    {
      name: 'cultivation.present',
      update(ft: number, world: EngineWorld) {
        t += ft;
        // slow walk in a circle (placeholder locomotion)
        player.position.x = Math.cos(t * 0.3) * 8;
        player.position.z = Math.sin(t * 0.3) * 8;
        const yaw = t * 0.3 + Math.PI / 2;
        rig.update(ft, player.position, yaw);
        if (world.playing) {
          progress = Math.min(1, progress + ft * 0.02);
        }
        ensureHud();
        if (hudEl) {
          hudEl.textContent = `修为 ${(progress * 100) | 0}% · 境界 ${realm} · 视角 ${mode} (1/2/3)`;
        }
      },
    },
  ];

  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
      scene.remove(root);
      hudEl?.remove();
      hudEl = null;
    },
    stats: () => ({ realm, progress, mode }),
  };
}

export const cultivation = defineGame({
  id: 'cultivation',
  title: 'Cultivation',
  map: { kind: 'stream', root: '/chunks', chunk: 40, lodRings: [1, 2] },
  camera: { default: 'chase', allow: ['fps', 'chase', 'orbit'] },
  config: { fixedDt: 1 / 60, gravity: 0 },
});
