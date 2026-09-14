/**
 * Sandbox recipe — place/remove voxels with mouse.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { VoxelChunk } from '../blocks/world/VoxelChunk';
import { HudPanel } from '../blocks/ui/HudPanel';
import { Toast } from '../blocks/ui/Toast';
import type { System, EngineWorld } from '../engine/types';

export interface SandboxRecipeOpts extends BaseRecipeOpts {
  size?: number;
}

const COLORS = [0x6ec8ff, 0xffd27a, 0x5dcea0, 0xe07070, 0xc4a35a];

export function createSandboxGame(
  opts: SandboxRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const size = opts.size ?? 16;

  const root = new THREE.Group();
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size + 4, size + 4),
    new THREE.MeshStandardMaterial({ color: 0x3a4a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const voxels = new VoxelChunk({ size });
  const geo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
  const mats = COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c }));
  const inst = new THREE.InstancedMesh(geo, mats[0], size * size * size);
  inst.count = 0;
  inst.castShadow = true;
  root.add(inst);
  const dummy = new THREE.Object3D();

  function rebuild() {
    const data = voxels.toInstanceData();
    const n = data.length / 4;
    inst.count = n;
    for (let i = 0; i < n; i++) {
      dummy.position.set(data[i * 4], data[i * 4 + 1] + 0.5, data[i * 4 + 2]);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }
  voxels.onChange = rebuild;

  // starter platform
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) voxels.set(x, 0, z, 1);
  }

  const hud = new HudPanel({ id: 'sandbox-hud', position: 'tl' });
  const toast = new Toast();
  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.2, orbit: { distance: 22, height: 18, pitch: 0.7 } });
  let colorIdx = 0;
  let mode: 'add' | 'remove' = 'add';

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function castVoxel(ev: MouseEvent) {
    const el = document.getElementById('app') ?? document.body;
    const r = el.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return { x: Math.round(hit.x), z: Math.round(hit.z) };
  }

  function onClick(ev: MouseEvent) {
    const c = castVoxel(ev);
    if (!c) return;
    if (mode === 'add') {
      // find top y at cell
      let y = 0;
      while (voxels.get(c.x, y, c.z) && y < size - 1) y++;
      if (voxels.set(c.x, y, c.z, colorIdx + 1)) toast.show(`+ (${c.x},${y},${c.z})`);
    } else {
      let y = size - 1;
      while (y >= 0 && !voxels.get(c.x, y, c.z)) y--;
      if (y >= 0 && voxels.remove(c.x, y, c.z)) toast.show(`- (${c.x},${y},${c.z})`);
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.code === 'KeyX') {
      mode = mode === 'add' ? 'remove' : 'add';
      toast.show(mode === 'add' ? '放置' : '挖除');
    }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= COLORS.length) {
      colorIdx = n - 1;
      (inst.material as THREE.MeshStandardMaterial) = mats[colorIdx];
      inst.material = mats[colorIdx];
      toast.show(`颜色 ${n}`);
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, _world: EngineWorld) {
        void ft;
        rig.update(0.016, new THREE.Vector3(0, 2, 0), performance.now() / 10000);
        hud.setText(
          `方块 ${voxels.count} · 模式 ${mode === 'add' ? '放置' : '挖除'} · 色 ${colorIdx + 1}\n点击操作 · X 切换 · 1-5 选色`,
        );
      },
    },
  ];

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('click', onClick);
        window.removeEventListener('keydown', onKey);
      }
      scene.remove(root);
      hud.dispose();
      toast.dispose();
      geo.dispose();
      for (const m of mats) m.dispose();
    },
    stats: () => ({ count: voxels.count, mode, colorIdx }),
  };
}

export function sandboxRecipe(opts: SandboxRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: 'orbit',
    create: (ctx) => createSandboxGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
