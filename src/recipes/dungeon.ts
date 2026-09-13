/**
 * Dungeon recipe — chain of rooms with locked doors + simple boss room.
 */
import * as THREE from 'three';
import { defineGame } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Interactable } from '../blocks/interact/Interactable';
import { TriggerZone } from '../blocks/interact/TriggerZone';
import { Health } from '../blocks/gameplay/Health';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import type { System, EngineWorld } from '../engine/types';

export interface DungeonRecipeOpts {
  id: string;
  title?: string;
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

  const ph = new Health({ max: opts.playerHp ?? 100 });
  const score = new Scoreboard();
  const keys = new Set<string>();
  let roomIdx = 0;
  let bossHp = 80;
  let status: 'playing' | 'win' | 'lose' = 'playing';
  let hud: HTMLElement | null = null;
  let endEl: HTMLElement | null = null;
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
      },
    });
  }

  const exit = new TriggerZone({
    shape: { kind: 'sphere', x: (roomCount - 1) * (roomW + gap), z: 0, radius: 2.5 },
    onEnter: () => {
      if (status === 'playing' && roomIdx === roomCount - 1 && bossHp <= 0) {
        status = 'win';
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
    if (endEl || typeof document === 'undefined') return;
    endEl = document.createElement('div');
    endEl.style.cssText =
      'position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font:28px/1.4 system-ui,sans-serif;color:#fff';
    endEl.textContent = win ? '通关' : '阵亡';
    endEl.style.color = win ? '#5dcea0' : '#e07070';
    document.body.appendChild(endEl);
  }

  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'KeyF') {
      for (const r of rooms) r.door?.tryUse(player.position.x, player.position.z);
    }
    if (e.code === 'KeyJ' || e.code === 'Space') {
      if (roomIdx === roomCount - 1 && bossHp > 0 && status === 'playing') {
        const bx = (roomCount - 1) * (roomW + gap);
        if (Math.hypot(player.position.x - bx, player.position.z) < 6) {
          bossHp = Math.max(0, bossHp - 15);
          score.add('dmg', 15);
          if (bossHp <= 0) score.addKill();
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
          if (hud) hud.textContent = `房 ${roomIdx + 1}/${roomCount} · Boss ${bossHp} [${status}]`;
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
        // clamp to current room if door still locked
        const roomMin = roomIdx * (roomW + gap) - roomW / 2 + 1;
        const roomMax = roomIdx * (roomW + gap) + roomW / 2 - 1;
        player.position.x = THREE.MathUtils.clamp(player.position.x, roomMin, roomMax);
        rig.update(ft, player.position, Math.atan2(mx, mz) || 0);
        exit.update([{ tag: 'p', x: player.position.x, z: player.position.z }]);

        if (!hud && typeof document !== 'undefined') {
          hud = document.createElement('div');
          hud.id = 'dungeon-hud';
          hud.style.cssText =
            'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.5 monospace;background:rgba(0,0,0,.5);padding:10px 14px;border-radius:8px;pointer-events:none;white-space:pre';
          document.body.appendChild(hud);
        }
        if (hud) {
          const nearDoor = rooms[roomIdx]?.door;
          const doorHint = nearDoor && nearDoor.available && nearDoor.inRange(player.position.x, player.position.z)
            ? ' · E/F 开门'
            : '';
          const bossHint = roomIdx === roomCount - 1 && bossHp > 0 ? ' · J/空格 打 Boss' : '';
          hud.textContent =
            `房 ${roomIdx + 1}/${roomCount} · Boss ${bossHp}${doorHint}${bossHint}`;
        }
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
      hud?.remove();
      endEl?.remove();
    },
    stats: () => ({ room: roomIdx, bossHp, status }),
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
