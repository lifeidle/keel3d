/**
 * Puzzle recipe — push crates onto targets (sokoban-lite, no physics engine).
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { HudPanel } from '../blocks/ui/HudPanel';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import type { System, EngineWorld } from '../engine/types';

export interface PuzzleRecipeOpts extends BaseRecipeOpts {
  /** grid map: # wall, . floor, C crate, T target, P player */
  map?: string[];
}

const DEFAULT_MAP = [
  '#######',
  '#.....#',
  '#.C.T.#',
  '#..P..#',
  '#.C.T.#',
  '#.....#',
  '#######',
];

export function createPuzzleGame(
  opts: PuzzleRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const map = opts.map ?? DEFAULT_MAP;
  const rows = map.length;
  const cols = Math.max(...map.map((r) => r.length));

  type Cell = 0 | 1 | 2 | 3 | 4; // empty wall crate target player-start
  const grid: number[][] = [];
  let px = 1;
  let pz = 1;
  const crates: { x: number; z: number; mesh: THREE.Mesh }[] = [];
  const targets = new Set<string>();

  const root = new THREE.Group();
  scene.add(root);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a4a3a });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a5a52 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xc4a35a });
  const targetMat = new THREE.MeshStandardMaterial({ color: 0x5dcea0, emissive: 0x113322 });

  for (let z = 0; z < rows; z++) {
    grid[z] = [];
    for (let x = 0; x < cols; x++) {
      const ch = map[z][x] ?? '.';
      let v: Cell = 0;
      if (ch === '#') v = 1;
      else if (ch === 'C') v = 2;
      else if (ch === 'T') {
        v = 3;
        targets.add(`${x},${z}`);
      } else if (ch === 'P') {
        v = 4;
        px = x;
        pz = z;
      }
      grid[z][x] = v === 4 ? 0 : v;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, v === 1 ? 1.2 : 0.15, 1),
        v === 1 ? wallMat : floorMat,
      );
      mesh.position.set(x, v === 1 ? 0.6 : 0.05, z);
      mesh.receiveShadow = true;
      root.add(mesh);
      if (v === 3) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16), targetMat);
        t.position.set(x, 0.12, z);
        root.add(t);
      }
      if (v === 2) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), crateMat);
        c.position.set(x, 0.5, z);
        c.castShadow = true;
        root.add(c);
        crates.push({ x, z, mesh: c });
      }
    }
  }

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6ec8ff }),
  );
  player.position.set(px, 0.7, pz);
  root.add(player);

  const score = new Scoreboard();
  const hud = new HudPanel({ id: 'puzzle-hud', position: 'tl' });
  const endOverlay = new EndOverlay();
  const sfx = new KitSfx();
  const toast = new Toast();
  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.2, orbit: { distance: 14, height: 12, pitch: 0.85 } });

  function solid(x: number, z: number): boolean {
    return x < 0 || z < 0 || x >= cols || z >= rows || grid[z][x] === 1;
  }
  function crateAt(x: number, z: number) {
    return crates.find((c) => c.x === x && c.z === z);
  }

  function tryMove(dx: number, dz: number) {
    const nx = px + dx;
    const nz = pz + dz;
    if (solid(nx, nz)) return;
    const cr = crateAt(nx, nz);
    if (cr) {
      const bx = nx + dx;
      const bz = nz + dz;
      if (solid(bx, bz) || crateAt(bx, bz)) return;
      cr.x = bx;
      cr.z = bz;
      cr.mesh.position.set(bx, 0.5, bz);
    }
    px = nx;
    pz = nz;
    player.position.set(px, 0.7, pz);
    score.add('moves', 1);
    checkWin();
  }

  function checkWin() {
    const done = crates.every((c) => targets.has(`${c.x},${c.z}`));
    if (done && crates.length) {
      endOverlay.show(`解开！步数 ${score.get('moves')}`, true);
      toast.show('全部归位');
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') tryMove(0, -1);
    if (e.code === 'KeyS' || e.code === 'ArrowDown') tryMove(0, 1);
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') tryMove(-1, 0);
    if (e.code === 'KeyD' || e.code === 'ArrowRight') tryMove(1, 0);
  }
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, _w: EngineWorld) {
        score.tick(ft);
        if (status === 'playing' && typeof (globalThis as any).__puzzleWin === 'function' && (globalThis as any).__puzzleWin()) {
          status = 'win';
          sfx.play('win');
          endOverlay.show('解开谜题 — 按 R 再来', true);
        }
        rig.update(ft, new THREE.Vector3(cols / 2, 0, rows / 2), 0.3);
        const done = crates.filter((c) => targets.has(`${c.x},${c.z}`)).length;
        hud.setText(`目标：把箱子推到金点 · 推箱子 · 归位 ${done}/${crates.length} · 步数 ${score.get('moves')}\nWASD 推动木箱到绿台`);
      },
    },
  ];

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
      scene.remove(root);
      hud.dispose();
      endOverlay.dispose();
      toast.dispose();
    },
    stats: () => ({ moves: score.get('moves'), crates: crates.length }),
  };
}

export function puzzleRecipe(opts: PuzzleRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: 'orbit',
    create: (ctx) => createPuzzleGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
