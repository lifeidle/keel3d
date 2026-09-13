/**
 * Spec skeleton — race (Sample path for vehicle physics + fixed track).
 * Loadable via ?game=race. Minimal: orbit/chase camera, looped track marker.
 * Independent: no imports from other game/* packages.
 */
import * as THREE from 'three';
import { defineGame } from '../../content/defineGame';
import { CameraRig } from '../../blocks/CameraRig';
import { Path } from '../../blocks/Path';
import type { System, EngineWorld } from '../../engine/types';

export interface RaceDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

const TRACK = new Path([
  { x: -20, y: 0, z: -12 },
  { x: 20, y: 0, z: -12 },
  { x: 24, y: 0, z: 12 },
  { x: -24, y: 0, z: 12 },
  { x: -20, y: 0, z: -12 },
]);

export function createRaceGame(deps: RaceDeps) {
  const { scene, camera } = deps;
  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 50),
    new THREE.MeshStandardMaterial({ color: 0x7a9a55 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const pts = TRACK.points.map((p) => new THREE.Vector3(p.x, 0.05, p.z));
  root.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    ),
  );
  const pos = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 0 };
  for (let d = 0; d <= TRACK.totalLen; d += 2.5) {
    TRACK.sampleAt(d, pos);
    TRACK.sampleDir(d, dir);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.1, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x4a4a4a }),
    );
    slab.position.set(pos.x, 0.05, pos.z);
    slab.rotation.y = Math.atan2(dir.x, dir.z);
    slab.receiveShadow = true;
    root.add(slab);
  }

  const car = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, 3.2),
    new THREE.MeshStandardMaterial({ color: 0xe23c3c, metalness: 0.35, roughness: 0.35 }),
  );
  car.position.y = 0.45;
  car.castShadow = true;
  root.add(car);

  const rig = new CameraRig(camera, { defaultMode: 'chase', chase: { distance: 8, height: 3, lookAhead: 3 } });
  let dist = 0;
  let t = 0;
  let lap = 0;
  let hud: HTMLElement | null = null;

  const systems: System[] = [
    {
      name: 'race.sim',
      update(ft: number, world: EngineWorld) {
        t += ft;
        if (world.playing) {
          const speed = 12;
          const prev = dist;
          dist = (dist + speed * ft) % TRACK.totalLen;
          if (dist < prev) lap++;
        }
        TRACK.sampleAt(dist, pos);
        TRACK.sampleDir(dist, dir);
        car.position.set(pos.x, 0.4, pos.z);
        car.rotation.y = Math.atan2(dir.x, dir.z);
        rig.update(ft, car.position, car.rotation.y);
        if (typeof document !== 'undefined') {
          if (!hud) {
            hud = document.createElement('div');
            hud.id = 'race-hud';
            hud.style.cssText =
              'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.4 monospace;background:rgba(0,0,0,.45);padding:8px 12px;border-radius:6px';
            document.body.appendChild(hud);
          }
          hud.textContent = `赛车骨架 · vehicle · 圈 ${lap} · 里程 ${(dist).toFixed(1)}m`;
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

export const race = defineGame({
  id: 'race',
  title: 'Race',
  camera: { default: 'chase', allow: ['chase', 'orbit'] },
  map: {
    kind: 'fixed',
    maps: [
      {
        id: 'loop1',
        title: 'Loop',
        terrain: { size: 80 },
        pois: [
          { id: 'start', x: -20, z: -12 },
          { id: 't1', x: 20, z: -12 },
        ],
      },
    ],
  },
  player: { model: 'car.glb', physics: 'vehicle' },
  config: { fixedDt: 1 / 60 },
});
