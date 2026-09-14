/**
 * Tycoon recipe — place buildings, earn income, grow population.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { PlaceGrid } from '../blocks/gameplay/PlaceGrid';
import { Economy } from '../blocks/gameplay/Economy';
import { BuildSystem, type BuildCatalog } from '../blocks/build/BuildCatalog';
import { Timers } from '../blocks/gameplay/Timers';
import { RunState } from '../blocks/progress/RunState';
import { HudPanel } from '../blocks/ui/HudPanel';
import { Toast } from '../blocks/ui/Toast';
import { ButtonBar } from '../blocks/ui/ButtonBar';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { KitSfx } from '../blocks/audio/KitSfx';
import { PauseMenu } from '../blocks/ui/PauseMenu';
import { ControlsOverlay } from '../blocks/ui/ControlsOverlay';
import type { System, EngineWorld } from '../engine/types';

export interface TycoonRecipeOpts extends BaseRecipeOpts {
  startMoney?: number;
  gridSize?: number;
  cell?: number;
}

const CATALOG: BuildCatalog = {
  house: { key: 'house', name: '住宅', cost: 40, produce: 2, produceEvery: 4, color: 0x6a9bd1 },
  shop: { key: 'shop', name: '商店', cost: 80, produce: 5, produceEvery: 5, color: 0xc17a4a },
  park: { key: 'park', name: '公园', cost: 60, produce: 1, produceEvery: 6, color: 0x5dcea0 },
};

export function createTycoonGame(
  opts: TycoonRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const cell = opts.cell ?? 4;
  const n = opts.gridSize ?? 8;
  const half = (n * cell) / 2;

  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(n * cell + 8, n * cell + 8),
    new THREE.MeshStandardMaterial({ color: 0x5a8f4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const grid = new PlaceGrid({ originX: -half, originZ: -half, cell, width: n, height: n });
  const eco = new Economy({ start: opts.startMoney ?? 150 });
  const run = new RunState();
  const hud = new HudPanel({ id: 'tycoon-hud', position: 'tl' });
  const toast = new Toast();
  const endOverlay = new EndOverlay();
  const sfx = new KitSfx();
  const POP_GOAL = 50;
  let status: 'playing' | 'win' = 'playing';
  const pause = new PauseMenu({
    active: () => status === 'playing',
  });
  const controls = new ControlsOverlay({
    hints: [
      { keys: ['1', '2', '3'], label: '选建筑' },
      { keys: ['左键'], label: '建造' },
      { keys: ['Esc'], label: '暂停' },
    ],
    footer: '桌面设备体验更佳',
    duration: 6,
  });
  const timers = new Timers();
  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.2, orbit: { distance: 36, height: 30, pitch: 0.75 } });

  let selected: keyof typeof CATALOG = 'house';
  let population = 0;
  const meshes = new Map<string, THREE.Mesh>();

  const build = new BuildSystem({
    catalog: CATALOG,
    canPay: (c) => eco.balance >= c,
    pay: (c) => {
      eco.spend(c);
    },
    onPlace: (b) => {
      const def = CATALOG[b.key];
      const w = grid.cellToWorld(b.ix, b.iz);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, b.key === 'shop' ? 2.4 : 1.4, 2.2),
        new THREE.MeshStandardMaterial({ color: def.color ?? 0x888888 }),
      );
      mesh.position.set(w.x, (b.key === 'shop' ? 2.4 : 1.4) / 2, w.z);
      mesh.castShadow = true;
      root.add(mesh);
      meshes.set(`${b.ix},${b.iz}`, mesh);
      population += b.key === 'house' ? 4 : b.key === 'shop' ? 2 : 1;
      if (population >= POP_GOAL && status === 'playing') {
        status = 'win';
        sfx.play('win');
        endOverlay.show(`达标！人口 ${population} · 建筑 ${build.buildings.length} — 按 R 再来`, true);
      }
      toast.show(`建造 ${def.name ?? b.key}`);
    },
  });

  let selectedCost = CATALOG.house.cost;
  const bar = new ButtonBar({
    onClick: (id) => {
      if (id in CATALOG) {
        selected = id as keyof typeof CATALOG;
        selectedCost = CATALOG[selected].cost;
        toast.show(`选中 ${CATALOG[selected].name}`);
      }
    },
  });
  bar.setSlots([
    { id: 'house', label: '住宅 40', key: '1' },
    { id: 'shop', label: '商店 80', key: '2' },
    { id: 'park', label: '公园 60', key: '3' },
  ]);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function placeAt(ix: number, iz: number) {
    if (!grid.isFree(ix, iz)) {
      toast.show('地块已占用');
      return;
    }
    const b = build.place(selected, ix, iz);
    if (b) grid.occupy(ix, iz);
    else toast.show('资金不足');
  }

  function onClick(ev: MouseEvent) {
    const el = document.getElementById('app') ?? document.body;
    const r = el.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      const c = grid.worldToCell(hit.x, hit.z);
      if (grid.inBounds(c.ix, c.iz)) placeAt(c.ix, c.iz);
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === '1') selected = 'house';
    if (e.key === '2') selected = 'shop';
    if (e.key === '3') selected = 'park';
    selectedCost = CATALOG[selected].cost;
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && status !== 'playing' && typeof location !== 'undefined') location.reload();
    });
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (pause.paused) return;
        timers.update(ft);
        if (world.playing) {
          scoreTick(ft);
          const made = build.update(ft);
          if (made > 0) eco.add(made);
        }
        rig.update(ft, new THREE.Vector3(0, 0, 0), performance.now() / 8000);
        hud.setText(
          `金钱 ${eco.balance} · 人口 ${population} · 建筑 ${build.buildings.length} · 用时 ${run.time.toFixed(0)}s\n` +
            `目标人口 ${POP_GOAL} · 选中 ${CATALOG[selected].name}(${selectedCost}) · 点空地建造 · R 重开`,
        );
      },
    },
    pause.system,
    controls.system,
  ];

  function scoreTick(ft: number) {
    run.tick(ft);
  }

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
      endOverlay.dispose();
      sfx.dispose();
      bar.dispose();
      timers.clear();
      pause.dispose();
      controls.dispose();
    },
    stats: () => ({ money: eco.balance, population, buildings: build.buildings.length }),
  };
}

export function tycoonRecipe(opts: TycoonRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: 'orbit',
    create: (ctx) => createTycoonGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
