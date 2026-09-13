/**
 * Sample B — demo-tower (tower defense).
 * Independent content package: must NOT import nightraid or demo-cultivation.
 * Phase D: skeleton + fixed map + orbit camera; waves/towers land next.
 */
import * as THREE from 'three';
import { defineGame } from '../../content/defineGame';
import { CameraRig } from '../../blocks/CameraRig';
import { Path } from '../../blocks/Path';
import type { System, EngineWorld } from '../../engine/types';
import type { FixedMapDef } from '../../content/define';

/** One fixed grass map: a single enemy lane + tower pads. */
export const grass1: FixedMapDef = {
  id: 'grass1',
  title: 'Grass Lane',
  terrain: { size: 60 },
  pois: [
    { id: 'lane0', x: -20, z: 0 },
    { id: 'lane1', x: 0, z: 0 },
    { id: 'lane2', x: 20, z: 0 },
    { id: 'base', x: 24, z: 0 },
  ],
  spawn: [{ id: 'enemy', x: -24, z: 0, side: 'hostile' }],
};

const LANE = new Path([
  { x: -24, y: 0, z: 0 },
  { x: -8, y: 0, z: 4 },
  { x: 8, y: 0, z: -4 },
  { x: 24, y: 0, z: 0 },
]);

export interface TowerDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  parent?: HTMLElement;
}

/** Minimal tower-defense runtime — zero nightraid imports. */
export function createTowerGame(deps: TowerDeps) {
  const { scene, camera } = deps;
  const root = new THREE.Group();
  scene.add(root);

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x3d5c3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  // lane ribbon (debug)
  const laneMat = new THREE.LineBasicMaterial({ color: 0xc4a35a });
  const lanePts = LANE.points.map((p) => new THREE.Vector3(p.x, 0.05, p.z));
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lanePts), laneMat));

  // base marker
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0x4a7ab5 }),
  );
  base.position.set(24, 1, 0);
  root.add(base);

  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.25 });
  let baseHp = 20;
  let money = 100;
  let wave = 0;
  let t = 0;
  let hudEl: HTMLElement | null = null;

  function ensureHud() {
    if (hudEl || typeof document === 'undefined') return;
    hudEl = document.createElement('div');
    hudEl.id = 'tower-hud';
    hudEl.style.cssText =
      'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.4 monospace;background:rgba(0,0,0,.45);padding:8px 12px;border-radius:6px;pointer-events:none';
    document.body.appendChild(hudEl);
  }

  function syncHud() {
    ensureHud();
    if (!hudEl) return;
    hudEl.textContent = `金钱 ${money} · 波次 ${wave} · 基地 ${baseHp}`;
  }

  const systems: System[] = [
    {
      name: 'tower.present',
      update(ft: number, world: EngineWorld) {
        t += ft;
        // orbit the lane center
        rig.update(ft, new THREE.Vector3(0, 0, 0), t * 0.15);
        if (world.playing) {
          // future: wave spawn, tower attack, base damage
        }
        syncHud();
      },
    },
  ];

  return {
    systems,
    dispose() {
      scene.remove(root);
      hudEl?.remove();
      hudEl = null;
    },
    stats: () => ({ money, wave, baseHp }),
  };
}

export const tower = defineGame({
  id: 'tower',
  title: 'Tower',
  map: { kind: 'fixed', maps: [grass1] },
  camera: 'orbit',
  config: { fixedDt: 1 / 60 },
});
