/**
 * Tower-defense recipe — data in, playable game out.
 * Copy this file into your game and edit the options, or call createTowerDefenseGame.
 * Opt-in only: nothing here is auto-registered by the host.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Path, type PathPoint } from '../blocks/Path';
import { Pool } from '../blocks/Pool';
import { Economy } from '../blocks/gameplay/Economy';
import { WaveDirector, type WaveDef } from '../blocks/gameplay/WaveDirector';
import { Health } from '../blocks/gameplay/Health';
import { PlaceGrid } from '../blocks/gameplay/PlaceGrid';
import { BuildSystem, type BuildCatalog, type BuildingDef } from '../blocks/build/BuildCatalog';
import { HudPanel } from '../blocks/ui/HudPanel';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import { KitSfx } from '../blocks/audio/KitSfx';
import type { System, EngineWorld } from '../engine/types';

export interface TdTowerDef {
  key: string;
  cost: number;
  range: number;
  rate: number; // shots / s
  damage: number;
  color: number;
  /** Upgrade target key + extra cost (optional depth). */
  upgradeTo?: string;
  upgradeCost?: number;
}

export interface TowerDefenseRecipeOpts extends BaseRecipeOpts {
  /** Lane polyline (XZ). */
  lane: PathPoint[];
  /** Buildable pad centers. */
  pads: Array<{ x: number; z: number }>;
  waves?: WaveDef[];
  startMoney?: number;
  baseHp?: number;
  towers?: TdTowerDef[];
  enemyHp?: number;
  enemySpeed?: number;
  bounty?: number;
  groundColor?: number;
}

const DEFAULT_TOWERS: TdTowerDef[] = [
  { key: 'rapid', cost: 50, range: 11, rate: 4, damage: 8, color: 0x6a9bd1, upgradeTo: 'rapid2', upgradeCost: 80 },
  { key: 'rapid2', cost: 0, range: 13, rate: 5.5, damage: 12, color: 0x8eb6e8 },
  { key: 'cannon', cost: 120, range: 14, rate: 0.8, damage: 28, color: 0xc17a4a },
  { key: 'frost', cost: 90, range: 11, rate: 1.2, damage: 6, color: 0x7ad1c9 },
];

function defaultWaves(): WaveDef[] {
  return [0, 1, 2, 3, 4].map((i) => ({
    count: 3 + (i + 1) * 2,
    interval: 0.55,
    delay: i === 0 ? 2 : 4,
    unit: 'grunt',
  }));
}

function toCatalog(towers: TdTowerDef[]): BuildCatalog {
  const cat: BuildCatalog = {};
  for (const t of towers) {
    const def: BuildingDef = {
      key: t.key,
      name: t.key,
      cost: t.cost,
      color: t.color,
      upgradeTo: t.upgradeTo,
      upgradeCost: t.upgradeCost,
    };
    cat[t.key] = def;
  }
  return cat;
}

export function createTowerDefenseGame(
  opts: TowerDefenseRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const lane = new Path(opts.lane);
  const towerDefs = opts.towers ?? DEFAULT_TOWERS;
  const startMoney = opts.startMoney ?? 100;
  const baseHpMax = opts.baseHp ?? 20;
  const bounty = opts.bounty ?? 10;
  const enemyHp = opts.enemyHp ?? 40;
  const enemySpeed = opts.enemySpeed ?? 3.5;
  const defByKey = new Map(towerDefs.map((d) => [d.key, d]));
  const selectable = towerDefs.filter((d) => d.cost > 0);

  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: opts.groundColor ?? 0x6b9e4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const pos = { x: 0, y: 0, z: 0 };
  for (let d = 0; d <= lane.totalLen; d += 2) {
    lane.sampleAt(d, pos);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xc49a52 }),
    );
    slab.position.set(pos.x, 0.04, pos.z);
    slab.receiveShadow = true;
    root.add(slab);
  }

  const end = lane.end();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.6, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x3d7ec4 }),
  );
  base.position.set(end.x, 1.3, end.z);
  base.castShadow = true;
  root.add(base);

  // PlaceGrid tracks pad occupancy (cell = pad index for this recipe)
  const grid = new PlaceGrid({ originX: -30, originZ: -30, cell: 4, width: 16, height: 16 });
  const pads = opts.pads.map((p, i) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 0.2, 18),
      new THREE.MeshStandardMaterial({ color: 0x8a9a7a }),
    );
    m.position.set(p.x, 0.1, p.z);
    m.receiveShadow = true;
    root.add(m);
    const cell = grid.worldToCell(p.x, p.z);
    return { x: p.x, z: p.z, mesh: m, ix: cell.ix, iz: cell.iz, index: i, occupied: false };
  });

  interface E {
    mesh: THREE.Mesh;
    dist: number;
    speed: number;
    alive: boolean;
    health: Health;
  }
  const enemyGeo = new THREE.BoxGeometry(0.9, 1.3, 0.9);
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0xd94b4b });
  const enemies = new Pool<E>(
    () => {
      const mesh = new THREE.Mesh(enemyGeo, enemyMat);
      mesh.visible = false;
      root.add(mesh);
      return {
        mesh,
        dist: 0,
        speed: enemySpeed,
        alive: false,
        health: new Health({ max: 1 }),
      };
    },
    (e) => {
      e.alive = false;
      e.mesh.visible = false;
    },
    16,
  );

  const eco = new Economy({ start: startMoney });
  let baseHp = baseHpMax;
  let status: 'playing' | 'win' | 'lose' = 'playing';
  let selected = 0;
  let t = 0;

  const hud = new HudPanel({ id: 'td-hud', position: 'tl' });
  const endOverlay = new EndOverlay();
  const toast = new Toast();
  const sfx = new KitSfx();

  const towerMeshes = new Map<string, THREE.Mesh>();
  const build = new BuildSystem({
    catalog: toCatalog(towerDefs),
    canPay: (cost) => eco.balance >= cost,
    pay: (cost) => {
      eco.spend(cost);
    },
    onPlace: (b) => {
      const def = defByKey.get(b.key);
      const pad = pads.find((p) => p.ix === b.ix && p.iz === b.iz);
      if (!def || !pad) return;
      pad.occupied = true;
      grid.occupy(b.ix, b.iz);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 1.7, 1.3),
        new THREE.MeshStandardMaterial({ color: def.color }),
      );
      mesh.position.set(pad.x, 0.9, pad.z);
      mesh.castShadow = true;
      root.add(mesh);
      towerMeshes.set(`${b.ix},${b.iz}`, mesh);
      toast.show(`放置 ${def.key}`);
    },
    onUpgrade: (b) => {
      const def = defByKey.get(b.key);
      const mesh = towerMeshes.get(`${b.ix},${b.iz}`);
      if (def && mesh) {
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(def.color);
        mesh.scale.setScalar(1 + (b.level - 1) * 0.15);
      }
      toast.show(`升级 → ${b.key} Lv${b.level}`);
    },
  });

  const director = new WaveDirector({
    waves: opts.waves ?? defaultWaves(),
    spawnFn: () => {
      const e = enemies.acquire();
      e.alive = true;
      e.speed = enemySpeed;
      e.dist = 0;
      e.health = new Health({
        max: enemyHp + director.waveNumber * 8,
        onDeath: () => {
          e.alive = false;
          enemies.release(e);
          eco.add(bounty);
        },
      });
      e.mesh.visible = true;
      lane.sampleAt(0, pos);
      e.mesh.position.set(pos.x, 0.6, pos.z);
    },
  });

  function showEnd(win: boolean) {
    if (status !== 'playing') return;
    status = win ? 'win' : 'lose';
    endOverlay.show(win ? '胜利' : '失败', win);
    sfx.play(win ? 'win' : 'lose');
  }

  function syncHud() {
    const sel = selectable[Math.min(selected, selectable.length - 1)];
    hud.setText(
      `金钱 ${eco.balance} · 波次 ${director.waveNumber}/${director.totalWaves} · 基地 ${baseHp}\n` +
        `选塔 ${selectable.map((d, i) => `${i + 1}${d.key}(${d.cost})`).join(' ')} · 当前 ${sel?.key ?? '-'}\n` +
        `左键放置/升级 · 右键售卖 · 场上 ${enemies.activeCount}` +
        (status !== 'playing' ? ` [${status}]` : ''),
    );
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function placeOrUpgrade(ix: number) {
    if (status !== 'playing') return;
    const pad = pads[ix];
    if (!pad) return;
    if (pad.occupied) {
      build.upgrade(pad.ix, pad.iz);
      return;
    }
    const def = selectable[Math.min(selected, selectable.length - 1)];
    if (!def) return;
    build.place(def.key, pad.ix, pad.iz);
  }

  function sellPad(ix: number) {
    if (status !== 'playing') return;
    const pad = pads[ix];
    if (!pad || !pad.occupied) return;
    const removed = build.remove(pad.ix, pad.iz);
    if (!removed) return;
    grid.release(pad.ix, pad.iz);
    pad.occupied = false;
    const key = `${pad.ix},${pad.iz}`;
    const mesh = towerMeshes.get(key);
    if (mesh) {
      root.remove(mesh);
      (mesh.material as THREE.Material).dispose();
      mesh.geometry.dispose();
      towerMeshes.delete(key);
    }
    const refund = Math.floor((removed.def.cost || 0) * 0.5);
    eco.add(refund);
    toast.show(`售出 ${removed.def.key} +${refund}`);
  }

  function pickPad(ev: MouseEvent): number {
    const el = document.getElementById('app') ?? document.body;
    const r = el.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pads.map((p) => p.mesh), false);
    if (!hits.length) return -1;
    return pads.findIndex((p) => p.mesh === hits[0].object);
  }

  function onClick(ev: MouseEvent) {
    const idx = pickPad(ev);
    if (idx >= 0) placeOrUpgrade(idx);
  }

  function onContext(ev: MouseEvent) {
    ev.preventDefault();
    const idx = pickPad(ev);
    if (idx >= 0) sellPad(idx);
  }

  function onKey(e: KeyboardEvent) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= selectable.length) selected = n - 1;
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('click', onClick);
    window.addEventListener('contextmenu', onContext);
    window.addEventListener('keydown', onKey);
  }

  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.25 });

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        t += ft;
        rig.update(ft, new THREE.Vector3(0, 0, 0), t * 0.12);
        if (!world.playing || status !== 'playing') {
          syncHud();
          return;
        }
        director.update(ft);

        enemies.forEachLive((e) => {
          if (!e.alive) return;
          e.dist += e.speed * ft;
          if (e.dist >= lane.totalLen) {
            e.alive = false;
            enemies.release(e);
            baseHp = Math.max(0, baseHp - 1);
            if (baseHp <= 0) showEnd(false);
            return;
          }
          lane.sampleAt(e.dist, pos);
          e.mesh.position.set(pos.x, 0.6, pos.z);
        });

        for (const b of build.buildings) {
          const def = defByKey.get(b.key);
          if (!def) continue;
          const mesh = towerMeshes.get(`${b.ix},${b.iz}`);
          if (!mesh) continue;
          // reuse produceT as shot timer for towers (rate = shots/s)
          b.produceT -= ft;
          if (b.produceT > 0) continue;
          let target: E | null = null;
          let best = Infinity;
          enemies.forEachLive((e) => {
            if (!e.alive) return;
            const d = e.mesh.position.distanceTo(mesh.position);
            if (d < def.range && d < best) {
              best = d;
              target = e;
            }
          });
          if (target) {
            b.produceT = 1 / def.rate;
            (target as E).health.damage(def.damage);
          }
        }

        if (director.finished && enemies.activeCount === 0) showEnd(true);
        syncHud();
      },
    },
  ];

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('click', onClick);
        window.removeEventListener('contextmenu', onContext);
        window.removeEventListener('keydown', onKey);
      }
      scene.remove(root);
      hud.dispose();
      endOverlay.dispose();
      toast.dispose();
      sfx.dispose();
    },
    stats: () => ({
      money: eco.balance,
      wave: director.waveNumber,
      baseHp,
      status,
      towers: build.buildings.length,
    }),
  };
}

/** Ready-made defineGame wrapper around the recipe. */
export function towerDefenseRecipe(opts: TowerDefenseRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: 'orbit',
    map: { kind: 'fixed', maps: [{ id: 'lane', terrain: { size: 60 } }] },
    create: (ctx) =>
      createTowerDefenseGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
