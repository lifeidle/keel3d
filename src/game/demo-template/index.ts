/**
 * game-template — empty content package skeleton.
 * Copy this folder to src/game/<your-id>/ and fill the spec + systems.
 * Rules: do not import other game/* folders; only engine/blocks/content.
 */
import * as THREE from 'three';
import { defineGame } from '../../content/defineGame';
import { CameraRig, type CameraMode } from '../../blocks/CameraRig';
import { buildMap } from '../../blocks/MapBuilder';
import type { System, EngineWorld } from '../../engine/types';

export interface TemplateDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createTemplateGame(deps: TemplateDeps) {
  const { scene, camera } = deps;
  const root = new THREE.Group();
  scene.add(root);

  // pick one map mode and implement the matching loader
  buildMap(
    { kind: 'seeded', gen: (seed) => ({ seed }) },
    { seeded: (seed) => ({ seed }) },
    { seed: 1 },
  );

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x445544 }),
  );
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  const rig = new CameraRig(camera, { defaultMode: 'orbit' });
  let t = 0;
  let mode: CameraMode = 'orbit';

  function onKey(e: KeyboardEvent) {
    if (e.key === '1') {
      mode = 'fps';
      rig.setMode('fps');
    } else if (e.key === '2') {
      mode = 'chase';
      rig.setMode('chase');
    } else if (e.key === '3') {
      mode = 'orbit';
      rig.setMode('orbit');
    }
  }
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);

  const systems: System[] = [
    {
      name: 'template.present',
      update(ft: number, world: EngineWorld) {
        t += ft;
        rig.update(ft, new THREE.Vector3(0, 0, 0), t * 0.2);
        if (world.playing) {
          // your systems here
        }
      },
    },
  ];

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
      scene.remove(root);
    },
    stats: () => ({ mode, t }),
  };
}

export const template = defineGame({
  id: 'template',
  title: 'Template',
  camera: { default: 'orbit', allow: ['fps', 'chase', 'orbit'] },
  map: { kind: 'seeded', gen: (seed) => ({ seed }) },
  config: { fixedDt: 1 / 60 },
});
