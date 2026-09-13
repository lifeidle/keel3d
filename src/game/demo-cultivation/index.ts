/**
 * Sample C — demo-cultivation (open world, multi-camera).
 * Independent content package: must NOT import nightraid or demo-tower.
 * Phase E: stream placeholder chunks + runtime camera switch + wandering mobs.
 */
import * as THREE from 'three';
import { defineGame } from '../../content/defineGame';
import { CameraRig, type CameraMode } from '../../blocks/CameraRig';
import { Path } from '../../blocks/Path';
import { Pool } from '../../blocks/Pool';
import * as Steering from '../../blocks/Steering';
import { ChunkWorld } from '../../blocks/ChunkWorld';
import { buildMap } from '../../blocks/MapBuilder';
import { HealthBar } from '../../blocks/ui/HealthBar';
import type { System, EngineWorld } from '../../engine/types';

export interface CultivationDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

const REALMS = ['炼气', '筑基', '金丹', '元婴'];

/** Loose loop around the origin — a "spirit beast" patrol. */
const BEAST_PATH = new Path([
  { x: -12, y: 0, z: -12 },
  { x: 12, y: 0, z: -10 },
  { x: 14, y: 0, z: 12 },
  { x: -10, y: 0, z: 14 },
  { x: -12, y: 0, z: -12 },
]);

interface Beast {
  mesh: THREE.Mesh;
  dist: number;
  hp: number;
  alive: boolean;
}

export function createCultivationGame(deps: CultivationDeps) {
  const { scene, camera } = deps;
  const root = new THREE.Group();
  scene.add(root);

  // stream map via framework MapBuilder + ChunkWorld
  buildMap(
    { kind: 'stream', root: '/chunks', chunk: 40, lodRings: [1] },
    { stream: () => ({ ready: true }) },
  );
  const chunkWorld = new ChunkWorld({
    chunkSize: 40,
    ring: 1,
    buildChunk: (cx, cz) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(38, 38),
        new THREE.MeshStandardMaterial({
          color: (cx + cz) % 2 === 0 ? 0x5a8f4a : 0x6aa055,
          roughness: 0.92,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      g.add(m);
      // sparse trees for readability
      for (let i = 0; i < 4; i++) {
        const hx = ((cx * 17 + i * 13) % 29) - 14;
        const hz = ((cz * 19 + i * 7) % 31) - 15;
        if (Math.hypot(hx, hz) < 6) continue;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x6b4a2a }),
        );
        trunk.position.set(hx, 1.1, hz);
        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(1.6, 3.2, 7),
          new THREE.MeshStandardMaterial({ color: 0x3f7a38 }),
        );
        crown.position.set(hx, 3.2, hz);
        crown.castShadow = true;
        g.add(trunk, crown);
      }
      return g;
    },
  });
  root.add(chunkWorld.object3D);

  // cultivation dais
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 3.1, 0.5, 28),
    new THREE.MeshStandardMaterial({ color: 0xd4c48a, emissive: 0x332a10, roughness: 0.55 }),
  );
  dais.position.set(0, 0.25, 0);
  dais.castShadow = true;
  dais.receiveShadow = true;
  root.add(dais);

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.0, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x5b8fd4 }),
  );
  player.position.set(0, 1, 0);
  player.castShadow = true;
  root.add(player);

  const beastGeo = new THREE.BoxGeometry(1.2, 1.0, 1.8);
  const beastMat = new THREE.MeshStandardMaterial({ color: 0xb85c2a, roughness: 0.55 });
  const beasts = new Pool<Beast>(
    () => {
      const mesh = new THREE.Mesh(beastGeo, beastMat);
      mesh.visible = false;
      root.add(mesh);
      return { mesh, dist: 0, hp: 0, alive: false };
    },
    (b) => {
      b.alive = false;
      b.mesh.visible = false;
    },
    4,
  );

  const rig = new CameraRig(camera, { defaultMode: 'chase', blend: 0.2 });
  let mode: CameraMode = 'chase';
  let realmIdx = 0;
  let progress = 0;
  let t = 0;
  let spawnCd = 4;
  let hudEl: HTMLElement | null = null;
  let xpBar: HealthBar | null = null;
  const pos = { x: 0, y: 0, z: 0 };

  function setMode(m: CameraMode) {
    mode = m;
    rig.setMode(m);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === '1') setMode('fps');
    else if (e.key === '2') setMode('chase');
    else if (e.key === '3') setMode('orbit');
  }

  function ensureHud() {
    if (hudEl || typeof document === 'undefined') return;
    hudEl = document.createElement('div');
    hudEl.id = 'cultivation-hud';
    hudEl.style.cssText =
      'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.5 monospace;background:rgba(0,0,0,.45);padding:8px 12px;border-radius:6px;pointer-events:none;white-space:pre';
    document.body.appendChild(hudEl);
    xpBar = new HealthBar({ width: 120, height: 6, color: '#ffd27a' });
    if (xpBar.el) {
      xpBar.el.style.cssText += 'position:fixed;left:12px;top:72px;z-index:20;';
      document.body.appendChild(xpBar.el);
    }
  }

  const systems: System[] = [
    {
      name: 'cultivation.sim',
      update(ft: number, world: EngineWorld) {
        t += ft;
        // slow walk in a circle
        player.position.x = Math.cos(t * 0.3) * 8;
        player.position.z = Math.sin(t * 0.3) * 8;
        const yaw = t * 0.3 + Math.PI / 2;
        chunkWorld.update(player.position.x, player.position.z);
        rig.update(ft, player.position, yaw);

        if (world.playing) {
          // near dais → cultivate
          const nearDais = player.position.length() < 3.2;
          if (nearDais) {
            progress += ft * 0.08;
            if (progress >= 1) {
              progress = 0;
              realmIdx = Math.min(REALMS.length - 1, realmIdx + 1);
            }
          }

          // spawn / move beasts
          spawnCd -= ft;
          if (spawnCd <= 0 && beasts.activeCount < 3) {
            spawnCd = 5;
            const b = beasts.acquire();
            b.alive = true;
            b.hp = 30;
            b.dist = Math.random() * BEAST_PATH.totalLen;
            b.mesh.visible = true;
            BEAST_PATH.sampleAt(b.dist, pos);
            b.mesh.position.set(pos.x, 0.5, pos.z);
          }
          beasts.forEachLive((b) => {
            if (!b.alive) return;
            b.dist = (b.dist + ft * 2.2) % BEAST_PATH.totalLen;
            BEAST_PATH.sampleAt(b.dist, pos);
            b.mesh.position.set(pos.x, 0.5, pos.z);
            // steer slightly toward player when close (simple chase)
            const dx = player.position.x - b.mesh.position.x;
            const dz = player.position.z - b.mesh.position.z;
            const d = Math.hypot(dx, dz);
            if (d < 10 && d > 1.2) {
              const dir = Steering.normalizeXZ(dx, dz);
              b.mesh.position.x += dir.x * ft * 1.5;
              b.mesh.position.z += dir.z * ft * 1.5;
            }
            b.mesh.lookAt(player.position.x, 0.5, player.position.z);
          });
        }

        ensureHud();
        xpBar?.setRatio(progress);
        if (hudEl) {
          hudEl.textContent =
            `修为 ${(progress * 100) | 0}% · 境界 ${REALMS[realmIdx]}\n` +
            `视角 ${mode} (1第一/2第三/3俯视) · 妖兽 ${beasts.activeCount} · chunk ${chunkWorld.loadedCount}\n` +
            `站上中央修炼台涨修为`;
        }
      },
    },
  ];

  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
      scene.remove(root);
      chunkWorld.dispose();
      hudEl?.remove();
      hudEl = null;
      xpBar?.dispose();
      xpBar = null;
    },
    stats: () => ({ realm: REALMS[realmIdx], progress, mode, beasts: beasts.activeCount }),
  };
}

export default defineGame({
  id: 'cultivation',
  title: 'Cultivation',
  daylight: true,
  camera: { default: 'chase', allow: ['fps', 'chase', 'orbit'] },
  map: { kind: 'stream', root: '/chunks', chunk: 40, lodRings: [1, 2] },
  config: { fixedDt: 1 / 60, gravity: 0 },
  create: (ctx) => createCultivationGame({ scene: ctx.scene, camera: ctx.camera }),
});
