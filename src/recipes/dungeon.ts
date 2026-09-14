/**
 * Dungeon recipe — chain of rooms with locked doors + simple boss room.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Interactable } from '../blocks/interact/Interactable';
import { TriggerZone } from '../blocks/interact/TriggerZone';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { LevelTable } from '../blocks/progress/LevelTable';
import { HudPanel } from '../blocks/ui/HudPanel';
import { Toast } from '../blocks/ui/Toast';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { MinimapDots } from '../blocks/ui/MinimapDots';
import { KitSfx } from '../blocks/audio/KitSfx';
import { BossBar } from '../blocks/ui/BossBar';
import type { System, EngineWorld } from '../engine/types';

export interface DungeonRecipeOpts extends BaseRecipeOpts {
  rooms?: number;
  moveSpeed?: number;
  playerHp?: number;
}

export function createDungeonGame(
  opts: DungeonRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const roomCount = opts.rooms ?? 3;
  const moveSpeed = opts.moveSpeed ?? 8;
  const roomW = 16;
  const gap = 4;

  const root = new THREE.Group();
  scene.add(root);

  const rooms: { center: number; door: Interactable | null; cleared: boolean }[] = [];
  for (let i = 0; i < roomCount; i++) {
    const cx = i * (roomW + gap);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(roomW, roomW),
      new THREE.MeshStandardMaterial({ color: i === roomCount - 1 ? 0x4a3040 : 0x3a4a3a }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, 0);
    floor.receiveShadow = true;
    root.add(floor);
    rooms.push({ center: cx, door: null, cleared: false });
  }

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xd4c48a }),
  );
  player.position.set(0, 1, 0);
  root.add(player);

  const score = new Scoreboard();
  const keys = new Set<string>();
  let roomIdx = 0;
  let bossHp = 80;
  let status: 'playing' | 'win' | 'lose' = 'playing';

  // LevelTable: each room is a level; unlock next when previous cleared
  const levels = new LevelTable(
    Array.from({ length: roomCount }, (_, i) => ({
      id: `room${i}`,
      title: i === roomCount - 1 ? 'Boss 房' : `房间 ${i + 1}`,
      requires: i === 0 ? undefined : `room${i - 1}`,
    })),
  );

  const hud = new HudPanel({ id: 'dungeon-hud', position: 'tl' });
  const toast = new Toast();
  const endOverlay = new EndOverlay();
  const sfx = new KitSfx();
  const bossBar = new BossBar({ id: 'dungeon-boss' });
  const worldHalf = (roomCount - 1) * (roomW + gap) + roomW / 2 + 6;
  const minimap = new MinimapDots({ size: 120, worldHalf });

  const rig = new CameraRig(camera, { defaultMode: 'chase', blend: 0.2, chase: { distance: 10, height: 5, lookAhead: 2 } });

  // door interactables between rooms
  for (let i = 0; i < roomCount - 1; i++) {
    const dx = i * (roomW + gap) + roomW / 2 + gap / 2;
    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a }),
    );
    doorMesh.position.set(dx, 1.5, 0);
    root.add(doorMesh);
    rooms[i].door = new Interactable({
      id: 'door' + i,
      x: dx,
      z: 0,
      radius: 3,
      hint: '开门',
      uses: 1,
      onUse: () => {
        doorMesh.visible = false;
        roomIdx = i + 1;
        levels.markCleared(`room${i}`);
        toast.show(`进入 ${levels.all[i + 1]?.title ?? `房间 ${i + 2}`}`);
      },
    });
  }

  const exit = new TriggerZone({
    shape: { kind: 'sphere', x: (roomCount - 1) * (roomW + gap), z: 0, radius: 2.5 },
    onEnter: () => {
      if (status === 'playing' && roomIdx === roomCount - 1 && bossHp <= 0) {
        status = 'win';
        levels.markCleared(`room${roomCount - 1}`);
        showEnd(true);
      }
    },
  });

  let dac: AudioContext | null = null;
  function doorBeep() {
    try {
      if (typeof AudioContext === 'undefined') return;
      dac = dac ?? new AudioContext();
      const o = dac.createOscillator();
      const g = dac.createGain();
      o.frequency.value = 520;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(dac.destination);
      o.start();
      o.stop(dac.currentTime + 0.08);
    } catch { /* silent */ }
  }

  function showEnd(win: boolean) {
    if (status !== 'playing' && status !== 'win') return;
    status = win ? 'win' : 'lose';
    endOverlay.show(win ? '通关' : '阵亡', win);
  }

  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'KeyF') {
      for (const r of rooms) {
        const before = roomIdx;
        r.door?.tryUse(player.position.x, player.position.z);
        if (roomIdx !== before) doorBeep();
      }
    }
    if (e.code === 'KeyJ' || e.code === 'Space') {
      if (roomIdx === roomCount - 1 && bossHp > 0 && status === 'playing') {
        const bx = (roomCount - 1) * (roomW + gap);
        if (Math.hypot(player.position.x - bx, player.position.z) < 6) {
          bossHp = Math.max(0, bossHp - 15);
          sfx.play('hit');
          bossBar.setHp(bossHp, 80);
          score.add('dmg', 15);
          if (bossHp <= 0) {
            score.addKill();
            toast.show('Boss 已倒下 — 前往出口');
            sfx.play('boom');
            bossBar.hide();
          }
        }
      }
    }
  }
  function onUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDn);
    window.addEventListener('keyup', onUp);
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (!world.playing || status !== 'playing') {
          hud.setText(`房 ${roomIdx + 1}/${roomCount} · Boss ${bossHp} [${status}]`);
          return;
        }
        score.tick(ft);
        for (const r of rooms) r.door?.update(ft);
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
          const maxX = (roomCount - 1) * (roomW + gap) + roomW / 2 - 1;
          player.position.x = THREE.MathUtils.clamp(player.position.x + mx * moveSpeed * ft, -roomW / 2 + 1, maxX);
          player.position.z = THREE.MathUtils.clamp(player.position.z + mz * moveSpeed * ft, -roomW / 2 + 1, roomW / 2 - 1);
        }
        const roomMin = roomIdx * (roomW + gap) - roomW / 2 + 1;
        const roomMax = roomIdx * (roomW + gap) + roomW / 2 - 1;
        player.position.x = THREE.MathUtils.clamp(player.position.x, roomMin, roomMax);
        rig.update(ft, player.position, Math.atan2(mx, mz) || 0);
        exit.update([{ tag: 'p', x: player.position.x, z: player.position.z }]);

        // minimap: rooms as dots, player blue
        const dots = rooms.map((r, i) => ({
          x: r.center,
          z: 0,
          color: i === roomIdx ? '#6ec8ff' : i < roomIdx ? '#5dcea0' : '#888',
        }));
        minimap.render(dots, player.position.x, player.position.z);

        const nearDoor = rooms[roomIdx]?.door;
        const doorHint = nearDoor && nearDoor.available && nearDoor.inRange(player.position.x, player.position.z)
          ? ' · E/F 开门'
          : '';
        const bossHint = roomIdx === roomCount - 1 && bossHp > 0 ? ' · J/空格 打 Boss' : '';
        const next = levels.nextLevel();
        hud.setText(
          `房 ${roomIdx + 1}/${roomCount}${next ? ` · ${next.title}` : ''} · Boss ${bossHp}${doorHint}${bossHint}`,
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
      toast.dispose();
      endOverlay.dispose();
      sfx.dispose();
      bossBar.dispose();
      minimap.dispose();
    },
    stats: () => ({ room: roomIdx, bossHp, status, cleared: levels.serialize() }),
  };
}

export function dungeonRecipe(opts: DungeonRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: { default: 'chase', allow: ['chase', 'orbit'] },
    create: (ctx) => createDungeonGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
