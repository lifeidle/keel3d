/**
 * Sample B — demo-tower (tower defense).
 * Independent content package: must NOT import nightraid or demo-cultivation.
 * Phase D: fixed map + orbit + waves + placeable towers + base HP.
 */
import * as THREE from 'three';
import { defineGame } from '../../content/defineGame';
import { CameraRig } from '../../blocks/CameraRig';
import { Path } from '../../blocks/Path';
import { Pool } from '../../blocks/Pool';
import { Economy } from '../../blocks/gameplay/Economy';
import { WaveDirector } from '../../blocks/gameplay/WaveDirector';
import { Health } from '../../blocks/gameplay/Health';
import { kitPad } from '../../blocks/kit/placeholders';
import type { System, EngineWorld } from '../../engine/types';
import type { FixedMapDef } from '../../content/define';

export const grass1: FixedMapDef = {
  id: 'grass1',
  title: 'Grass Lane',
  terrain: { size: 60 },
  pois: [
    { id: 'base', x: 24, z: 0 },
    { id: 'pad0', x: -6, z: 8 },
    { id: 'pad1', x: 4, z: -8 },
    { id: 'pad2', x: 12, z: 6 },
  ],
  spawn: [{ id: 'enemy', x: -24, z: 0, side: 'hostile' }],
};

const LANE = new Path([
  { x: -24, y: 0, z: 0 },
  { x: -10, y: 0, z: 5 },
  { x: 2, y: 0, z: -5 },
  { x: 14, y: 0, z: 3 },
  { x: 24, y: 0, z: 0 },
]);

type TowerKind = 'rapid' | 'cannon' | 'frost';
const TOWER_COST: Record<TowerKind, number> = { rapid: 50, cannon: 120, frost: 90 };
const TOWER_COLOR: Record<TowerKind, number> = {
  rapid: 0x6a9bd1,
  cannon: 0xc17a4a,
  frost: 0x7ad1c9,
};

interface EnemyMesh {
  mesh: THREE.Mesh;
  dist: number;
  hp: number;
  speed: number;
  alive: boolean;
  health?: Health;
}

interface TowerMesh {
  kind: TowerKind;
  mesh: THREE.Mesh;
  cd: number;
}

export interface TowerDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function createTowerGame(deps: TowerDeps) {
  const { scene, camera } = deps;
  const root = new THREE.Group();
  scene.add(root);
  const pos = { x: 0, y: 0, z: 0 };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x6b9e4a, roughness: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // lane ribbon (bright dirt road)
  const lanePts = LANE.points.map((p) => new THREE.Vector3(p.x, 0.06, p.z));
  const laneGeo = new THREE.BufferGeometry().setFromPoints(lanePts);
  root.add(new THREE.Line(laneGeo, new THREE.LineBasicMaterial({ color: 0xd4a85a })));
  // thick lane via small pads along the path
  for (let d = 0; d <= LANE.totalLen; d += 2) {
    LANE.sampleAt(d, pos);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xc49a52 }),
    );
    pad.position.set(pos.x, 0.04, pos.z);
    pad.receiveShadow = true;
    root.add(pad);
  }

  // base marker
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.6, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x3d7ec4 }),
  );
  base.position.set(24, 1.3, 0);
  base.castShadow = true;
  root.add(base);

  // tower pads
  const pads: { x: number; z: number; mesh: THREE.Mesh; occupied: boolean }[] = [];
  for (const p of grass1.pois!.filter((q) => q.id.startsWith('pad'))) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x8a9a7a, emissive: 0x223322 }),
    );
    m.position.set(p.x, 0.1, p.z);
    m.receiveShadow = true;
    root.add(m);
    pads.push({ x: p.x, z: p.z, mesh: m, occupied: false });
  }

  const enemyGeo = new THREE.BoxGeometry(0.9, 1.3, 0.9);
  const enemyMat = new THREE.MeshStandardMaterial({ color: 0xd94b4b, roughness: 0.6 });
  const enemyPool = new Pool<EnemyMesh>(
    () => {
      const mesh = new THREE.Mesh(enemyGeo, enemyMat);
      mesh.visible = false;
      root.add(mesh);
      return { mesh, dist: 0, hp: 0, speed: 4, alive: false };
    },
    (e) => {
      e.alive = false;
      e.mesh.visible = false;
    },
    12,
  );

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.25 });

  let baseHp = 20;
  const eco = new Economy({ start: 100 });
  let t = 0;
  let selected: TowerKind = 'rapid';
  let hudEl: HTMLElement | null = null;
  let endEl: HTMLElement | null = null;
  let status: 'playing' | 'win' | 'lose' = 'playing';
  const towers: (TowerMesh & { defBoost?: number })[] = [];

  const waves = [0, 1, 2, 3, 4].map((i) => ({
    count: 3 + (i + 1) * 2,
    interval: 0.55,
    delay: i === 0 ? 2 : 4,
    unit: 'grunt',
  }));
  const director = new WaveDirector({
    waves,
    spawnFn: () => spawnEnemy(),
  });

  function ensureHud() {
    if (hudEl || typeof document === 'undefined') return;
    hudEl = document.createElement('div');
    hudEl.id = 'tower-hud';
    hudEl.style.cssText =
      'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.5 monospace;background:rgba(0,0,0,.5);padding:10px 14px;border-radius:6px;pointer-events:none;white-space:pre';
    document.body.appendChild(hudEl);
  }

  function showEnd(win: boolean) {
    if (endEl || typeof document === 'undefined') return;
    status = win ? 'win' : 'lose';
    endEl = document.createElement('div');
    endEl.id = 'tower-end';
    endEl.style.cssText =
      'position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;font:28px/1.4 monospace;pointer-events:none';
    endEl.textContent = win ? '胜利 — 基地守住了' : '失败 — 基地被攻破';
    document.body.appendChild(endEl);
  }

  function syncHud() {
    ensureHud();
    if (!hudEl) return;
    const alive = enemyPool.activeCount;
    hudEl.textContent =
      `金钱 ${eco.balance} · 波次 ${director.waveNumber}/${director.totalWaves} · 基地 ${baseHp}\n` +
      `选塔 1/2/3 · 点空台放塔 · U 升级末塔 · 塔数 ${towers.length} · 末塔强化 ${(towers[towers.length-1]?.defBoost ?? 1).toFixed(2)}\n` +
      `场上敌人 ${enemyPool.activeCount}` + (status !== 'playing' ? `\n[${status}]` : '');
  }

  function placeTower(padIdx: number) {
    if (status !== 'playing') return;
    const pad = pads[padIdx];
    if (!pad || pad.occupied) return;
    const cost = TOWER_COST[selected];
    if (!eco.spend(cost)) return;
    pad.occupied = true;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.8, 1.4),
      new THREE.MeshStandardMaterial({ color: TOWER_COLOR[selected] }),
    );
    mesh.position.set(pad.x, 0.9, pad.z);
    root.add(mesh);
    towers.push({ kind: selected, mesh, cd: 0 });
  }

  function onClick(ev: MouseEvent) {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('app') ?? document.body;
    const r = el.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pads.map((p) => p.mesh), false);
    if (!hits.length) return;
    const idx = pads.findIndex((p) => p.mesh === hits[0].object);
    if (idx >= 0) placeTower(idx);
  }

  function upgradeTower() {
    if (status !== 'playing' || !towers.length) return;
    const tw = towers[towers.length - 1];
    const cost = Math.floor(TOWER_COST[tw.kind] * 0.6);
    if (!eco.spend(cost)) return;
    tw.defBoost = (tw.defBoost ?? 1) + 0.35;
    tw.mesh.scale.setScalar(1 + (tw.defBoost - 1) * 0.25);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === '1') selected = 'rapid';
    else if (e.key === '2') selected = 'cannon';
    else if (e.key === '3') selected = 'frost';
    else if (e.key === 'u' || e.key === 'U') upgradeTower();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
  }

  function spawnEnemy() {
    const e = enemyPool.acquire();
    const hp = 40 + director.waveNumber * 8;
    e.alive = true;
    e.hp = hp;
    e.speed = 3.5 + Math.min(2, director.waveNumber * 0.2);
    e.dist = 0;
    e.health = new Health({
      max: hp,
      onDeath: () => {
        e.alive = false;
        enemyPool.release(e);
        eco.add(10);
      },
    });
    e.mesh.visible = true;
    LANE.sampleAt(0, pos);
    e.mesh.position.set(pos.x, 0.6, pos.z);
  }

  const systems: System[] = [
    {
      name: 'tower.sim',
      update(ft: number, world: EngineWorld) {
        t += ft;
        rig.update(ft, new THREE.Vector3(0, 0, 0), t * 0.12);
        if (!world.playing || status !== 'playing') {
          syncHud();
          return;
        }

        director.update(ft);

        // enemies walk the lane
        enemyPool.forEachLive((e) => {
          if (!e.alive) return;
          e.dist += e.speed * ft;
          if (e.dist >= LANE.totalLen) {
            e.alive = false;
            enemyPool.release(e);
            baseHp = Math.max(0, baseHp - 1);
            if (baseHp <= 0) showEnd(false);
            return;
          }
          LANE.sampleAt(e.dist, pos);
          e.mesh.position.set(pos.x, 0.6, pos.z);
        });

        // towers fire
        for (const tw of towers) {
          tw.cd -= ft;
          if (tw.cd > 0) continue;
          const range = tw.kind === 'cannon' ? 14 : 11;
          const rate = tw.kind === 'rapid' ? 4 : tw.kind === 'cannon' ? 0.8 : 1.2;
          const baseDmg = tw.kind === 'rapid' ? 8 : tw.kind === 'cannon' ? 28 : 6;
          const dmg = Math.round(baseDmg * (tw.defBoost ?? 1));
          let target: EnemyMesh | null = null;
          let best = Infinity;
          enemyPool.forEachLive((e) => {
            if (!e.alive) return;
            const d = e.mesh.position.distanceTo(tw.mesh.position);
            if (d < range && d < best) {
              best = d;
              target = e;
            }
          });
          if (target) {
            tw.cd = 1 / rate;
            const e = target as EnemyMesh;
            if (e.health) e.health.damage(dmg);
            else {
              e.hp -= dmg;
              if (e.hp <= 0) {
                e.alive = false;
                enemyPool.release(e);
                eco.add(10);
              }
            }
          }
        }

        if (director.finished && enemyPool.activeCount === 0) {
          showEnd(true);
        }

        syncHud();
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
      hudEl?.remove();
      hudEl = null;
      endEl?.remove();
      endEl = null;
    },
    stats: () => ({
      money: eco.balance,
      wave: director.waveNumber,
      baseHp,
      towers: towers.length,
      status,
    }),
  };
}

export default defineGame({
  id: 'tower',
  title: 'Tower',
  daylight: true,
  camera: 'orbit',
  map: { kind: 'fixed', maps: [grass1] },
  config: { fixedDt: 1 / 60 },
  create: (ctx) => createTowerGame({ scene: ctx.scene, camera: ctx.camera }),
});
