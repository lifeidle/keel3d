/**
 * Roguelike recipe — procedural rooms, combat, loot into inventory, boss exit.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { generateDungeon, type RoomDef } from '../blocks/world/ProcDungeon';
import { CameraRig } from '../blocks/CameraRig';
import { Pool } from '../blocks/Pool';
import { Health } from '../blocks/gameplay/Health';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import * as Steering from '../blocks/Steering';
import { Inventory } from '../blocks/gameplay/Inventory';
import { LootTable } from '../blocks/gameplay/LootTable';
import { SaveSlot } from '../blocks/progress/SaveSlot';
import { HudPanel } from '../blocks/ui/HudPanel';
import { HealthBar } from '../blocks/ui/HealthBar';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import { InventoryGrid } from '../blocks/ui/InventoryGrid';
import type { System, EngineWorld } from '../engine/types';

export interface RoguelikeRecipeOpts extends BaseRecipeOpts {
  seed?: number;
  roomCount?: number;
  moveSpeed?: number;
  playerHp?: number;
  enemyHp?: number;
  enemySpeed?: number;
}

export function createRoguelikeGame(
  opts: RoguelikeRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const seed = opts.seed ?? (Math.floor(Math.random() * 1e9) || 1);
  const layout = generateDungeon(seed, { roomCount: opts.roomCount ?? 6 });
  const cell = 18;
  const moveSpeed = opts.moveSpeed ?? 8;
  const playerHpMax = opts.playerHp ?? 80;
  const enemyHp = opts.enemyHp ?? 25;
  const enemySpeed = opts.enemySpeed ?? 3.2;

  const root = new THREE.Group();
  scene.add(root);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a4a3a });
  const bossMat = new THREE.MeshStandardMaterial({ color: 0x4a3040 });
  const lootMat = new THREE.MeshStandardMaterial({ color: 0x4a4a30 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a5a52 });

  const roomPos = new Map<string, THREE.Vector3>();
  for (const r of layout.rooms) {
    const c = layout.roomCenter(r, cell);
    const pos = new THREE.Vector3(c.x, 0, c.z);
    roomPos.set(r.id, pos);
    const mat = r.kind === 'boss' ? bossMat : r.kind === 'loot' ? lootMat : floorMat;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.2, r.h), mat);
    floor.position.set(c.x, -0.1, c.z);
    floor.receiveShadow = true;
    root.add(floor);
    // simple walls
    for (const [dx, dz, sw, sd] of [
      [0, r.h / 2, r.w, 0.4],
      [0, -r.h / 2, r.w, 0.4],
      [r.w / 2, 0, 0.4, r.h],
      [-r.w / 2, 0, 0.4, r.h],
    ] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sw, 2, sd), wallMat);
      wall.position.set(c.x + dx, 1, c.z + dz);
      wall.castShadow = true;
      root.add(wall);
    }
  }
  // corridors as slabs
  for (const cor of layout.corridors) {
    const a = roomPos.get(cor.a);
    const b = roomPos.get(cor.b);
    if (!a || !b) continue;
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, len + 2), floorMat);
    slab.position.set(mid.x, -0.1, mid.z);
    slab.lookAt(b.x, -0.1, b.z);
    root.add(slab);
  }

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6ec8ff }),
  );
  const start = layout.roomCenter(layout.rooms[0], cell);
  player.position.set(start.x, 1, start.z);
  root.add(player);

  const ph = new Health({ max: playerHpMax });
  const score = new Scoreboard();
  const inv = new Inventory({ slots: 12 });
  const invGrid = new InventoryGrid(inv, { id: 'rogue-inv' });
  invGrid.hide();
  const loot = new LootTable([
    { id: 'scrap', weight: 60, qty: [1, 2] },
    { id: 'potion', weight: 30, qty: 1 },
    { id: 'relic', weight: 10, qty: 1 },
  ]);
  const meta = new SaveSlot({ key: 'keel3d-rogue-meta', version: 1 });
  const hud = new HudPanel({ id: 'rogue-hud', position: 'tl' });
  const hpBar = new HealthBar({ width: 120, height: 8 });
  if (hpBar.el) {
    hpBar.el.style.cssText += ';position:fixed;left:12px;bottom:12px;z-index:20;';
    document.body.appendChild(hpBar.el);
  }
  const endOverlay = new EndOverlay();
  const toast = new Toast();
  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.2, orbit: { distance: 22, height: 18, pitch: 0.7 } });

  interface E {
    mesh: THREE.Mesh;
    hp: number;
    alive: boolean;
  }
  const enemyPool = new Pool<E>(
    () => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1, 0.8),
        new THREE.MeshStandardMaterial({ color: 0xc44 }),
      );
      m.visible = false;
      root.add(m);
      return { mesh: m, hp: 0, alive: false };
    },
    (e) => {
      e.alive = false;
      e.mesh.visible = false;
    },
    16,
  );

  const cleared = new Set<string>();
  let roomIdx = 0;
  let status: 'playing' | 'win' | 'lose' = 'playing';
  let depth = 1;
  const keys = new Set<string>();

  function spawnRoom(r: RoomDef) {
    const c = roomPos.get(r.id)!;
    const n = r.kind === 'boss' ? 3 : r.kind === 'loot' ? 0 : 2;
    for (let i = 0; i < n; i++) {
      const e = enemyPool.acquire();
      e.alive = true;
      e.hp = enemyHp + (r.kind === 'boss' ? 20 : 0);
      e.mesh.position.set(c.x + (i - 1) * 2, 0.5, c.z + (i % 2) * 2);
      e.mesh.visible = true;
    }
  }

  function roomCleared(r: RoomDef) {
    if (cleared.has(r.id)) return;
    cleared.add(r.id);
    if (r.kind === 'loot') {
      for (const s of loot.roll(2)) inv.add(s);
      toast.show('拾取补给');
    }
    if (r.kind === 'boss') {
      status = 'win';
      const prev = (meta.load<{ depth?: number }>()?.depth ?? 0) as number;
      if (depth > prev) meta.save({ depth });
      endOverlay.show(`通关 · 层 ${depth} · 击杀 ${score.kills}`, true);
    } else {
      toast.show(`${r.id} 已肃清`);
    }
  }

  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'KeyI') invGrid.toggle();
  }
  function onUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDn);
    window.addEventListener('keyup', onUp);
  }

  spawnRoom(layout.rooms[0]);

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (!world.playing || status !== 'playing') {
          hpBar.setHp(ph.hp, playerHpMax);
          return;
        }
        score.tick(ft);
        let mx = 0;
        let mz = 0;
        if (keys.has('KeyW')) mz -= 1;
        if (keys.has('KeyS')) mz += 1;
        if (keys.has('KeyA')) mx -= 1;
        if (keys.has('KeyD')) mx += 1;
        const len = Math.hypot(mx, mz);
        if (len > 0) {
          mx /= len;
          mz /= len;
          player.position.x = THREE.MathUtils.clamp(player.position.x + mx * moveSpeed * ft, start.x - 80, start.x + 80);
          player.position.z = THREE.MathUtils.clamp(player.position.z + mz * moveSpeed * ft, start.z - 80, start.z + 80);
        }
        rig.update(ft, player.position, Math.atan2(mx, mz) || 0);

        // nearest room
        let best = 0;
        let bestD = Infinity;
        layout.rooms.forEach((r, i) => {
          const p = roomPos.get(r.id)!;
          const d = player.position.distanceTo(p);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        if (best !== roomIdx && bestD < 6) {
          roomIdx = best;
          const r = layout.rooms[roomIdx];
          if (!cleared.has(r.id)) spawnRoom(r);
        }

        // enemies chase + touch damage
        let living = 0;
        enemyPool.forEachLive((e) => {
          if (!e.alive) return;
          living++;
          const dx = player.position.x - e.mesh.position.x;
          const dz = player.position.z - e.mesh.position.z;
          const d = Math.hypot(dx, dz);
          if (d > 1.2) {
            const dir = Steering.normalizeXZ(dx, dz);
            e.mesh.position.x += dir.x * enemySpeed * ft;
            e.mesh.position.z += dir.z * enemySpeed * ft;
          } else if (Math.random() < ft * 0.9) {
            ph.damage(5);
            if (!ph.alive) {
              status = 'lose';
              endOverlay.show(`阵亡 · 击杀 ${score.kills}`, false);
            }
          }
        });

        // auto-kill when player walks into enemy (melee-ish for skeleton)
        enemyPool.forEachLive((e) => {
          if (!e.alive) return;
          const d = e.mesh.position.distanceTo(player.position);
          if (d < 1.5 && keys.has('Space')) {
            e.hp -= 20;
            if (e.hp <= 0) {
              e.alive = false;
              enemyPool.release(e);
              score.addKill();
              for (const s of loot.roll()) inv.add(s);
            }
          }
        });

        const cur = layout.rooms[roomIdx];
        if (living === 0 && !cleared.has(cur.id)) roomCleared(cur);

        hpBar.setHp(ph.hp, playerHpMax);
        hud.setText(
          `层 ${depth} · 房 ${roomIdx + 1}/${layout.rooms.length} · 击杀 ${score.kills} · HP ${ph.hp}\n` +
            `WASD 移动 · 空格攻击 · I 背包 · 房型 ${cur?.kind ?? '-'}`,
        );
      },
    },
  ];

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onDn);
        window.removeEventListener('keyup', onUp);
      }
      scene.remove(root);
      hud.dispose();
      hpBar.dispose();
      endOverlay.dispose();
      toast.dispose();
      invGrid.dispose();
    },
    stats: () => ({ seed, room: roomIdx, kills: score.kills, status, depth, cleared: cleared.size }),
  };
}

export function roguelikeRecipe(opts: RoguelikeRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: { default: 'orbit', allow: ['orbit', 'chase'] },
    create: (ctx) => createRoguelikeGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
