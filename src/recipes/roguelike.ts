/**
 * Roguelike — flagship playable run: rooms → loot → boss → win/lose + restart.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { generateDungeon, type RoomDef } from '../blocks/world/ProcDungeon';
import { CameraRig } from '../blocks/CameraRig';
import { Pool } from '../blocks/Pool';
import { Health } from '../blocks/gameplay/Health';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { Cooldown } from '../blocks/combat/Cooldown';
import * as Steering from '../blocks/Steering';
import { Inventory } from '../blocks/gameplay/Inventory';
import { LootTable } from '../blocks/gameplay/LootTable';
import { SaveSlot } from '../blocks/progress/SaveSlot';
import { HudPanel } from '../blocks/ui/HudPanel';
import { HealthBar } from '../blocks/ui/HealthBar';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import { InventoryGrid } from '../blocks/ui/InventoryGrid';
import { BossBar } from '../blocks/ui/BossBar';
import { KitSfx } from '../blocks/audio/KitSfx';
import { GameFeel } from '../blocks/fx/GameFeel';
import { PauseMenu } from '../blocks/ui/PauseMenu';
import { ControlsOverlay } from '../blocks/ui/ControlsOverlay';
import type { System, EngineWorld } from '../engine/types';

export interface RoguelikeRecipeOpts extends BaseRecipeOpts {
  seed?: number;
  roomCount?: number;
  moveSpeed?: number;
  playerHp?: number;
  enemyHp?: number;
  enemySpeed?: number;
  attackDamage?: number;
  attackCd?: number;
}

const ROOM_LABEL: Record<RoomDef['kind'], string> = {
  start: '起点',
  combat: '战斗',
  loot: '补给',
  boss: '首领',
};

export function createRoguelikeGame(
  opts: RoguelikeRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const seed = opts.seed ?? (Math.floor(Math.random() * 1e9) || 1);
  const layout = generateDungeon(seed, { roomCount: opts.roomCount ?? 6 });
  const cell = 18;
  const moveSpeed = opts.moveSpeed ?? 8.5;
  const playerHpMax = opts.playerHp ?? 100;
  const enemyHp = opts.enemyHp ?? 20;
  const enemySpeed = opts.enemySpeed ?? 2.8;
  const attackDamage = opts.attackDamage ?? 22;
  const attackCd = new Cooldown(opts.attackCd ?? 0.32);

  const root = new THREE.Group();
  scene.add(root);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a4a3a });
  const bossMat = new THREE.MeshStandardMaterial({ color: 0x4a3040 });
  const lootMat = new THREE.MeshStandardMaterial({ color: 0x4a4a30 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a5a52 });
  const goalMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0x332200 });

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
    if (r.kind === 'loot') {
      const chest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.8), goalMat);
      chest.position.set(c.x, 0.5, c.z);
      chest.castShadow = true;
      root.add(chest);
    }
  }
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
    { id: '废料', weight: 55, qty: [1, 2] },
    { id: '药水', weight: 35, qty: 1 },
    { id: '遗物', weight: 10, qty: 1 },
  ]);
  const meta = new SaveSlot({ key: 'keel3d-rogue-meta', version: 1 });
  const hud = new HudPanel({ id: 'rogue-hud', position: 'tl' });
  const hpBar = new HealthBar({ width: 140, height: 8 });
  if (hpBar.el) {
    hpBar.el.style.cssText += ';position:fixed;left:12px;bottom:12px;z-index:20;';
    document.body.appendChild(hpBar.el);
  }
  const endOverlay = new EndOverlay();
  const toast = new Toast();
  const sfx = new KitSfx();
  const bossBar = new BossBar({ id: 'rogue-boss' });
  const feel = new GameFeel();
  const rig = new CameraRig(camera, {
    defaultMode: 'orbit',
    blend: 0.2,
    orbit: { distance: 22, height: 18, pitch: 0.7 },
  });

  interface E {
    mesh: THREE.Mesh;
    hp: number;
    maxHp: number;
    alive: boolean;
    boss: boolean;
    mat: THREE.MeshStandardMaterial;
    flash: number;
  }
  const enemyPool = new Pool<E>(
    () => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.05, 0.85),
        new THREE.MeshStandardMaterial({ color: 0xc44 }),
      );
      m.visible = false;
      root.add(m);
      return {
        mesh: m,
        hp: 0,
        maxHp: 1,
        alive: false,
        boss: false,
        mat: m.material as THREE.MeshStandardMaterial,
        flash: 0,
      };
    },
    (e) => {
      e.alive = false;
      e.mesh.visible = false;
      e.boss = false;
      e.flash = 0;
    },
    20,
  );

  const cleared = new Set<string>();
  let roomIdx = 0;
  let status: 'playing' | 'win' | 'lose' = 'playing';
  let depth = 1;
  let bossRef: E | null = null;
  const keys = new Set<string>();

  function spawnRoom(r: RoomDef) {
    const c = roomPos.get(r.id)!;
    const n = r.kind === 'boss' ? 3 : r.kind === 'loot' ? 0 : 2;
    for (let i = 0; i < n; i++) {
      const e = enemyPool.acquire();
      e.alive = true;
      e.boss = r.kind === 'boss';
      e.maxHp = enemyHp + (r.kind === 'boss' ? 30 : 0);
      e.hp = e.maxHp;
      e.mat.color.setHex(r.kind === 'boss' ? 0x8b1a1a : 0xc44);
      e.mesh.scale.setScalar(r.kind === 'boss' ? 1.4 : 1);
      e.mesh.position.set(c.x + (i - 1) * 2.4, 0.5, c.z + (i % 2) * 2);
      e.mesh.visible = true;
      if (r.kind === 'boss') {
        bossRef = e;
        bossBar.show('地牢首领');
        bossBar.setHp(e.hp, e.maxHp);
      }
    }
  }

  function roomCleared(r: RoomDef) {
    if (cleared.has(r.id)) return;
    cleared.add(r.id);
    if (r.kind === 'loot') {
      for (const s of loot.roll(2)) inv.add(s);
      toast.show('打开补给箱');
      sfx.play('pickup');
    } else if (r.kind === 'boss') {
      status = 'win';
      sfx.play('win');
      bossBar.hide();
      const prev = (meta.load<{ depth?: number }>()?.depth ?? 0) as number;
      if (depth > prev) meta.save({ depth });
      const best = (meta.load<{ depth?: number }>()?.depth ?? depth) as number;
      endOverlay.show(
        `通关！层 ${depth} · 击杀 ${score.kills} · ${score.time.toFixed(0)}s · 最深 ${best} — 按 R 再来`,
        true,
      );
    } else if (r.kind === 'combat') {
      toast.show('房间肃清 · 前往下一处');
      sfx.play('click');
    }
  }

  function usePotion() {
    if (inv.count('药水') < 1) {
      toast.show('没有药水');
      return;
    }
    if (ph.hp >= playerHpMax) {
      toast.show('生命已满');
      return;
    }
    inv.remove('药水', 1);
    ph.heal(28);
    sfx.play('pickup');
    feel.flashOnce('rgba(90,220,140,0.25)', 200);
    toast.show('使用药水 +28');
  }

  function tryAttack() {
    if (!attackCd.tryFire()) return;
    let hit = false;
    enemyPool.forEachLive((e) => {
      if (!e.alive) return;
      const d = e.mesh.position.distanceTo(player.position);
      if (d < 2.0) {
        e.hp -= attackDamage;
        e.flash = 0.12;
        hit = true;
        sfx.play('hit');
        if (e.boss) bossBar.setHp(e.hp, e.maxHp);
        if (e.hp <= 0) {
          e.alive = false;
          enemyPool.release(e);
          score.addKill();
          sfx.play('boom');
          feel.shake(0.2, 0.3);
          if (e.boss) {
            bossRef = null;
            bossBar.hide();
          }
          for (const s of loot.roll()) inv.add(s);
        }
      }
    });
    if (!hit) sfx.play('shoot');
  }

  function restart() {
    if (typeof location !== 'undefined') location.reload();
  }

  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'KeyI') invGrid.toggle();
    if (e.code === 'KeyE') usePotion();
    if (e.code === 'KeyR' && status !== 'playing') restart();
  }
  function onUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDn);
    window.addEventListener('keyup', onUp);
  }
  const pause = new PauseMenu({
    title: 'Roguelike',
    active: () => status === 'playing',
  });
  const controls = new ControlsOverlay({
    title: 'Roguelike',
    hints: [
      { keys: ['W', 'A', 'S', 'D'], label: '移动' },
      { keys: ['空格'], label: '攻击' },
      { keys: ['E'], label: '喝药' },
      { keys: ['I'], label: '背包' },
      { keys: ['Esc'], label: '暂停' },
    ],
    footer: '桌面设备体验更佳',
    duration: 6,
  });

  spawnRoom(layout.rooms[0]);
  toast.show('清空房间前进 · 空格攻击 · E 喝药 · I 背包');

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        const feelOff = feel.update(ft);
        if (!world.playing || status !== 'playing' || pause.paused) {
          hpBar.setHp(ph.hp, playerHpMax);
          return;
        }
        score.tick(ft);
        attackCd.update(ft);
        let mx = 0;
        let mz = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
        const len = Math.hypot(mx, mz);
        if (len > 0) {
          mx /= len;
          mz /= len;
          player.position.x = THREE.MathUtils.clamp(player.position.x + mx * moveSpeed * ft, start.x - 80, start.x + 80);
          player.position.z = THREE.MathUtils.clamp(player.position.z + mz * moveSpeed * ft, start.z - 80, start.z + 80);
        }
        if (keys.has('Space')) tryAttack();
        rig.update(ft, player.position, Math.atan2(mx, mz) || 0);
        feel.applyToCamera(camera, feelOff);

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
          if (!cleared.has(r.id)) {
            spawnRoom(r);
            toast.show(`${ROOM_LABEL[r.kind]}房`);
          }
        }

        let living = 0;
        enemyPool.forEachLive((e) => {
          if (!e.alive) return;
          living++;
          if (e.flash > 0) {
            e.flash -= ft;
            e.mat.emissive.setHex(e.flash > 0 ? 0x662222 : 0x000000);
          }
          const dx = player.position.x - e.mesh.position.x;
          const dz = player.position.z - e.mesh.position.z;
          const d = Math.hypot(dx, dz);
          if (d > 1.2) {
            const dir = Steering.normalizeXZ(dx, dz);
            const sp = e.boss ? enemySpeed * 0.8 : enemySpeed;
            e.mesh.position.x += dir.x * sp * ft;
            e.mesh.position.z += dir.z * sp * ft;
          } else if (Math.random() < ft * 0.6) {
            ph.damage(e.boss ? 8 : 4);
            feel.flashOnce('rgba(255,60,60,0.3)', 160);
            feel.shake(0.08, 0.2);
            sfx.play('hit');
            if (!ph.alive) {
              status = 'lose';
              sfx.play('lose');
              bossBar.hide();
              endOverlay.show(`阵亡 · 击杀 ${score.kills} · ${score.time.toFixed(0)}s — 按 R 再来`, false);
            }
          }
        });

        const cur = layout.rooms[roomIdx];
        if (living === 0 && !cleared.has(cur.id)) roomCleared(cur);

        hpBar.setHp(ph.hp, playerHpMax);
        const potions = inv.count('药水');
        hud.setText(
          `层 ${depth} · ${ROOM_LABEL[cur?.kind ?? 'start']} ${roomIdx + 1}/${layout.rooms.length} · 击杀 ${score.kills}\n` +
            `HP ${ph.hp}/${playerHpMax} · 药水 ${potions}` +
            (bossRef ? ' · ⚠ 首领' : '') +
            `\nWASD 移动 · 空格攻击 · E 喝药 · I 背包`,
        );
      },
    },
    pause.system,
    controls.system,
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
      bossBar.dispose();
      sfx.dispose();
      feel.dispose();
      pause.dispose();
      controls.dispose();
    },
    stats: () => ({
      seed,
      room: roomIdx,
      kills: score.kills,
      status,
      depth,
      cleared: cleared.size,
      hp: ph.hp,
    }),
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
