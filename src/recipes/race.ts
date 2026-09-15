/**
 * Race recipe — looped track, auto-driven vehicle, lap timing + best-lap record.
 *
 * The demo version (src/game/demo-race) drives the car automatically; the
 * recipe keeps that out of the box (a vehicle-physics hook is a natural
 * extension point) and parameterizes track geometry, speed, and scoring.
 * Copy this file into your game, or call createRaceGame with your data.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Path, type PathPoint } from '../blocks/Path';
import { BestScoreSlot } from '../blocks/progress/SaveSlot';
import { HudPanel } from '../blocks/ui/HudPanel';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { PauseMenu } from '../blocks/ui/PauseMenu';
import { ControlsOverlay } from '../blocks/ui/ControlsOverlay';
import type { System, EngineWorld } from '../engine/types';

/** Default looped track (used when `track` is omitted). */
const DEFAULT_TRACK: PathPoint[] = [
  { x: -20, y: 0, z: -12 },
  { x: 20, y: 0, z: -12 },
  { x: 24, y: 0, z: 12 },
  { x: -24, y: 0, z: 12 },
  { x: -20, y: 0, z: -12 },
];

export interface RaceRecipeOpts extends BaseRecipeOpts {
  /**
   * Track polyline (XZ). Must form a loop (last point ≈ first).
   * Defaults to a ~137-unit rectangular loop when omitted.
   */
  track?: PathPoint[];
  /** Vehicle speed (units/s). */
  speed?: number;
  /** Ground plate size [width, depth]. */
  groundSize?: [number, number];
  groundColor?: number;
  carColor?: number;
  /** Best-lap SaveSlot key. */
  saveKey?: string;
  /** Laps to win (0 = endless time trial). */
  lapsToWin?: number;
  /** Chase camera distance. */
  camDistance?: number;
}

function trackMapSpec(track: PathPoint[]) {
  let minX = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxZ = -Infinity;
  for (const p of track) {
    minX = Math.min(minX, p.x);
    minZ = Math.min(minZ, p.z);
    maxX = Math.max(maxX, p.x);
    maxZ = Math.max(maxZ, p.z);
  }
  const size = Math.ceil(Math.max(maxX - minX, maxZ - minZ) + 20);
  return {
    kind: 'fixed' as const,
    maps: [
      {
        id: 'loop1',
        title: 'Loop',
        terrain: { size },
        pois: [{ id: 'start', x: track[0].x, z: track[0].z }],
      },
    ],
  };
}

export function createRaceGame(
  opts: RaceRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const track = new Path(opts.track ?? DEFAULT_TRACK);
  const speed = opts.speed ?? 12;
  const [gw, gd] = opts.groundSize ?? [80, 50];
  const lapsToWin = opts.lapsToWin ?? 0;
  const best = new BestScoreSlot(opts.saveKey ?? 'keel3d-race-best');

  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(gw, gd),
    new THREE.MeshStandardMaterial({ color: opts.groundColor ?? 0x7a9a55 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // track slabs along the path
  const pos = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 0 };
  for (let d = 0; d <= track.totalLen; d += 2.5) {
    track.sampleAt(d, pos);
    track.sampleDir(d, dir);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.1, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x4a4a4a }),
    );
    slab.position.set(pos.x, 0.05, pos.z);
    slab.rotation.y = Math.atan2(dir.x, dir.z);
    slab.receiveShadow = true;
    root.add(slab);
  }

  const car = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, 3.2),
    new THREE.MeshStandardMaterial({ color: opts.carColor ?? 0xe23c3c, metalness: 0.35, roughness: 0.35 }),
  );
  car.position.y = 0.45;
  car.castShadow = true;
  root.add(car);

  const rig = new CameraRig(camera, {
    defaultMode: 'chase',
    chase: { distance: opts.camDistance ?? 8, height: 3, lookAhead: 3 },
  });

  const hud = new HudPanel({ id: 'race-hud', position: 'tl' });
  const endOverlay = new EndOverlay();
  const pause = new PauseMenu({ title: '赛车', active: () => status === 'playing' });
  const controls = new ControlsOverlay({
    title: '赛车',
    hints: [
      { keys: ['自动'], label: '驾驶演示' },
      { keys: ['圈速'], label: '最佳圈存档' },
      { keys: ['Esc'], label: '暂停' },
    ],
    footer: '桌面设备体验更佳',
    duration: 6,
  });

  let dist = 0;
  let t = 0;
  let lap = 0;
  let lapT = 0;
  let bestLap: number | null = best.read('bestLap');
  let status: 'playing' | 'win' = 'playing';

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        t += ft;
        if (world.playing && status === 'playing' && !pause.paused) {
          const prev = dist;
          dist = (dist + speed * ft) % track.totalLen;
          lapT += ft;
          if (dist < prev) {
            lap++;
            const lt = Math.round(lapT * 100) / 100;
            best.submit(lt, 'bestLap', true);
            bestLap = best.read('bestLap');
            lapT = 0;
            if (lapsToWin > 0 && lap >= lapsToWin) {
              status = 'win';
              endOverlay.show(`完赛 · ${lap} 圈 · 最佳 ${bestLap}s`, true);
            }
          }
        }
        track.sampleAt(dist, pos);
        track.sampleDir(dist, dir);
        car.position.set(pos.x, 0.4, pos.z);
        car.rotation.y = Math.atan2(dir.x, dir.z);
        rig.update(ft, car.position, car.rotation.y);
        hud.setText(
          `圈 ${lap} · 里程 ${dist.toFixed(1)}m · 最佳圈 ${bestLap == null ? '—' : bestLap + 's'}${
            status === 'win' ? ' · 完赛' : ''
          }`,
        );
      },
    },
    pause.system,
    controls.system,
  ];

  return {
    systems,
    dispose() {
      scene.remove(root);
      hud.dispose();
      endOverlay.dispose();
      pause.dispose();
      controls.dispose();
    },
    stats: () => ({
      lap,
      dist,
      bestLap,
      status,
      time: t,
    }),
  };
}

export function raceRecipe(opts: RaceRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: { default: 'chase', allow: ['chase', 'orbit'] },
    map: trackMapSpec(opts.track ?? DEFAULT_TRACK),
    player: { model: 'car.glb', physics: 'vehicle' },
    create: (ctx) => createRaceGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
