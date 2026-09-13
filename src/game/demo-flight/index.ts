/**
 * Spec skeleton — flight (Sample path for air physics).
 * Loadable via ?game=flight. Minimal: zero gravity, chase camera, sky box.
 * Independent: no imports from other game/* packages.
 */
import * as THREE from 'three';
import { defineGame } from '../../content/defineGame';
import { CameraRig } from '../../blocks/CameraRig';
import type { System, EngineWorld } from '../../engine/types';

export interface FlightDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createFlightGame(deps: FlightDeps) {
  const { scene, camera } = deps;
  const root = new THREE.Group();
  scene.add(root);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x6a8ab0, side: THREE.BackSide }),
  );
  root.add(sky);

  const plane = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0xd0d0d0 }),
  );
  plane.rotation.x = Math.PI / 2;
  root.add(plane);

  // ground reference far below
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x3a4a38 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -40;
  root.add(ground);

  const rig = new CameraRig(camera, { defaultMode: 'chase', chase: { distance: 10, height: 3, lookAhead: 4 } });
  let t = 0;
  let hud: HTMLElement | null = null;

  const systems: System[] = [
    {
      name: 'flight.sim',
      update(ft: number, world: EngineWorld) {
        t += ft;
        const r = 30;
        plane.position.set(Math.cos(t * 0.4) * r, 10 + Math.sin(t * 0.7) * 4, Math.sin(t * 0.4) * r);
        const yaw = t * 0.4 + Math.PI / 2;
        plane.rotation.z = Math.sin(t * 0.7) * 0.3;
        rig.update(ft, plane.position, yaw);
        if (typeof document !== 'undefined') {
          if (!hud) {
            hud = document.createElement('div');
            hud.id = 'flight-hud';
            hud.style.cssText =
              'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.4 monospace;background:rgba(0,0,0,.45);padding:8px 12px;border-radius:6px';
            document.body.appendChild(hud);
          }
          hud.textContent = `飞行骨架 · physics air · gravity 0 · playing=${world.playing}`;
        }
      },
    },
  ];

  return {
    systems,
    dispose() {
      scene.remove(root);
      hud?.remove();
      hud = null;
    },
  };
}

export const flight = defineGame({
  id: 'flight',
  title: 'Flight',
  camera: 'chase',
  map: { kind: 'seeded', gen: (seed) => ({ seed, sky: true }) },
  player: { model: 'plane.glb', physics: 'air' },
  config: { gravity: 0, fixedDt: 1 / 60 },
});
