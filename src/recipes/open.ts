/**
 * Open-world recipe — streaming chunk world + multi-camera + goal chain.
 *
 * Extracted from the demo-cultivation content package and parameterized so an
 * open-world streaming demo can be started from a recipe. The demo keeps its
 * goal chain (orbs → dais breakthrough → beast swarm → win); set
 * `goalChain: false` for a plain exploration starter.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig, type CameraMode } from '../blocks/CameraRig';
import { Path } from '../blocks/Path';
import { Pool } from '../blocks/Pool';
import * as Steering from '../blocks/Steering';
import { ChunkWorld } from '../blocks/ChunkWorld';
import { buildMap } from '../blocks/MapBuilder';
import { HealthBar } from '../blocks/ui/HealthBar';
import { Pickup, PickupField } from '../blocks/interact/Pickup';
import { TriggerZone } from '../blocks/interact/TriggerZone';
import { QuestTracker } from '../blocks/ui/QuestTracker';
import { PauseMenu } from '../blocks/ui/PauseMenu';
import { ControlsOverlay } from '../blocks/ui/ControlsOverlay';
import type { System, EngineWorld } from '../engine/types';

export interface OpenWorldRecipeOpts extends BaseRecipeOpts {
  /** ChunkWorld chunk size. */
  chunkSize?: number;
  /** LOD rings to build around the player. */
  lodRings?: number[];
  /** Spirit orb positions (XZ). Default: five spots on the figure-8 patrol. */
  orbSpots?: Array<{ x: number; z: number }>;
  /** Central dais cultivation-aura radius. */
  daisRadius?: number;
  /** Cultivation progress per second while inside the aura. */
  cultivateRate?: number;
  /** Cultivation multiplier after the goal chain completes. */
  chainReward?: number;
  /** Orbs needed for the chain. */
  orbsNeeded?: number;
  /** Beasts alive at once needed for the chain. */
  beastsNeeded?: number;
  /** Enable the goal chain (win on all objectives). */
  goalChain?: boolean;
  /** Beast spawn interval (seconds). */
  beastSpawnEvery?: number;
  /** Max live beasts. */
  beastCap?: number;
  /** Beast HP. */
  beastHp?: number;
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

/** Five orb spots ON the figure-8 patrol (x=14cos θ, z=10sin 2θ). */
const DEFAULT_ORBS: Array<{ x: number; z: number }> = [
  { x: 12.1, z: 8.7 }, // θ=30°
  { x: 3.6, z: 5.0 }, // θ=75°
  { x: -12.1, z: -8.7 }, // θ=150°
  { x: -9.9, z: 10.0 }, // θ=225°
  { x: 7.0, z: -8.7 }, // θ=300°
];

interface Beast {
  mesh: THREE.Mesh;
  dist: number;
  hp: number;
  alive: boolean;
}

export function createOpenWorldGame(
  opts: OpenWorldRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const chunkSize = opts.chunkSize ?? 40;
  const lodRings = opts.lodRings ?? [1];
  const orbSpots = opts.orbSpots ?? DEFAULT_ORBS;
  const daisRadius = opts.daisRadius ?? 5.5;
  const cultivateRate = opts.cultivateRate ?? 0.16;
  const chainReward = opts.chainReward ?? 2;
  const orbsNeeded = opts.orbsNeeded ?? 3;
  const beastsNeeded = opts.beastsNeeded ?? 3;
  const goalChain = opts.goalChain ?? true;
  const beastSpawnEvery = opts.beastSpawnEvery ?? 5;
  const beastCap = opts.beastCap ?? 3;
  const beastHp = opts.beastHp ?? 30;

  const root = new THREE.Group();
  scene.add(root);

  // stream map via framework MapBuilder + ChunkWorld
  buildMap(
    { kind: 'stream', root: '/chunks', chunk: chunkSize, lodRings },
    { stream: () => ({ ready: true }) },
  );
  const chunkWorld = new ChunkWorld({
    chunkSize,
    ring: lodRings[0] ?? 1,
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
  // cultivation aura — the figure-8 patrol crosses this zone twice per cycle
  const aura = new THREE.Mesh(
    new THREE.CircleGeometry(daisRadius, 40),
    new THREE.MeshStandardMaterial({ color: 0x8ab4ff, emissive: 0x1a2a4a, transparent: true, opacity: 0.35 }),
  );
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.06;
  root.add(aura);

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
    beastCap,
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

  // Collect demo: spirit orbs + dais trigger
  const orbGeo = new THREE.SphereGeometry(0.35, 10, 8);
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xffd27a,
    emissive: 0x664400,
  });
  let collected = 0;
  const orbs = new PickupField(
    orbSpots.map((p, i) => {
      const mesh = new THREE.Mesh(orbGeo, orbMat);
      mesh.position.set(p.x, 0.8, p.z);
      mesh.castShadow = true;
      root.add(mesh);
      return new Pickup({
        id: `orb${i}`,
        x: p.x,
        z: p.z,
        y: 0.8,
        radius: 1.6,
        onCollect: () => {
          collected++;
          mesh.visible = false;
        },
      });
    }),
  );
  const daisZone = new TriggerZone({
    id: 'dais',
    shape: { kind: 'sphere', x: 0, z: 0, radius: daisRadius },
  });
  let onDais = false;

  // Goal chain: orbs → 筑基 breakthrough → beast swarm → win.
  const quest = new QuestTracker({ title: '目标链' });
  quest.setItems([
    { id: 'orbs', title: `拾取灵珠 ×${orbsNeeded}` },
    { id: 'realm', title: '修炼突破 · 筑基' },
    { id: 'beast', title: `妖兽齐至（×${beastsNeeded}）` },
  ]);
  let beastMax = 0;
  let chainDone = false;
  let status: 'playing' | 'win' = 'playing';
  const chainDoneFlags = { orbs: false, realm: false, beast: false };

  const pause = new PauseMenu({ title: '开放世界', active: () => status === 'playing' });
  const controls = new ControlsOverlay({
    title: '开放世界',
    hints: [
      { keys: ['8字'], label: '自动巡行' },
      { keys: ['1', '2', '3'], label: 'fps/追随/环绕' },
      { keys: ['Esc'], label: '暂停' },
    ],
    footer: '灵珠·突破·妖兽 目标链',
    duration: 6,
  });

  function checkChain() {
    if (!goalChain || chainDone) return;
    const flags = chainDoneFlags;
    if (!flags.orbs && collected >= orbsNeeded) {
      flags.orbs = true;
      quest.complete('orbs');
    }
    if (!flags.realm && realmIdx >= 1) {
      flags.realm = true;
      quest.complete('realm');
    }
    if (!flags.beast && beastMax >= beastsNeeded) {
      flags.beast = true;
      quest.complete('beast');
    }
    if (flags.orbs && flags.realm && flags.beast) {
      chainDone = true;
      status = 'win';
    }
  }

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
    hudEl.id = `${opts.id}-hud`;
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
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (!pause.paused) {
        t += ft;
        // figure-8 (Lissajous) patrol: crosses the central dais twice per cycle.
        player.position.x = Math.cos(t * 0.3) * 14;
        player.position.z = Math.sin(t * 0.6) * 10;
        const yaw = t * 0.3 + Math.PI / 2;
        chunkWorld.update(player.position.x, player.position.z);
        rig.update(ft, player.position, yaw);

        if (world.playing) {
          orbs.update(player.position.x, player.position.z, player.position.y);
          daisZone.update([{ tag: 'player', x: player.position.x, z: player.position.z, y: player.position.y }]);
          onDais = daisZone.has('player');
          // in the dais aura → cultivate (chain done → reward ×N)
          if (onDais) {
            progress += ft * (chainDone ? cultivateRate * chainReward : cultivateRate);
            if (progress >= 1) {
              progress = 0;
              realmIdx = Math.min(REALMS.length - 1, realmIdx + 1);
            }
          }

          // spawn / move beasts
          spawnCd -= ft;
          if (spawnCd <= 0 && beasts.activeCount < beastCap) {
            spawnCd = beastSpawnEvery;
            const b = beasts.acquire();
            b.alive = true;
            b.hp = beastHp;
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
          beastMax = Math.max(beastMax, beasts.activeCount);
          checkChain();
        }
        } // end !pause.paused

        ensureHud();
        xpBar?.setRatio(progress);
        if (hudEl) {
          const c = chainDoneFlags;
          hudEl.textContent =
            `修为 ${(progress * 100) | 0}% · 境界 ${REALMS[realmIdx]} · 灵珠 ${collected}/${orbSpots.length}\n` +
            `目标链 ${c.orbs ? '☑' : '☐'}灵珠×${orbsNeeded} ${c.realm ? '☑' : '☐'}突破筑基 ${c.beast ? '☑' : '☐'}妖兽×${beastsNeeded}${chainDone ? ' · ★全部完成' : ''}\n` +
            `视角 ${mode} (1/2/3) · 妖兽 ${beasts.activeCount} · chunk ${chunkWorld.loadedCount}\n` +
            (chainDone
              ? '★ 目标链完成 · 8 字巡行持续修炼'
              : onDais
                ? '【修炼中】站上中央台涨修为'
                : '8 字巡行：拾灵珠 · 中央台修炼 · 妖兽环伺');
        }
      },
    },
    pause.system,
    controls.system,
  ];

  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
      scene.remove(root);
      chunkWorld.dispose();
      quest.dispose();
      pause.dispose();
      controls.dispose();
      hudEl?.remove();
      hudEl = null;
      xpBar?.dispose();
      xpBar = null;
    },
    stats: () => ({
      realm: REALMS[realmIdx],
      progress,
      mode,
      beasts: beasts.activeCount,
      orbs: collected,
      status,
      chainDone,
      beastMax,
    }),
  };
}

export function openworldRecipe(opts: OpenWorldRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: { default: 'chase', allow: ['fps', 'chase', 'orbit'] },
    map: { kind: 'stream', root: '/chunks', chunk: opts.chunkSize ?? 40, lodRings: opts.lodRings ?? [1, 2] },
    config: { fixedDt: 1 / 60, gravity: 0 },
    create: (ctx) => createOpenWorldGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
