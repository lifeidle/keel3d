/**
 * RTS-lite recipe — box-ish select via click, right-click move, two factions.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Pool } from '../blocks/Pool';
import * as Steering from '../blocks/Steering';
import { GridAStar } from '../blocks/GridAStar';
import { FactionMap } from '../blocks/gameplay/Faction';
import { Health } from '../blocks/gameplay/Health';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { HudPanel } from '../blocks/ui/HudPanel';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import type { System, EngineWorld } from '../engine/types';

export interface RtsLiteRecipeOpts extends BaseRecipeOpts {
  units?: number;
  arena?: number;
}

interface U {
  mesh: THREE.Mesh;
  team: 'blue' | 'red';
  hp: Health;
  alive: boolean;
  targetX: number;
  targetZ: number;
  selected: boolean;
}

export function createRtsLiteGame(
  opts: RtsLiteRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const arena = opts.arena ?? 24;
  const nUnits = opts.units ?? 6;

  const root = new THREE.Group();
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 2, arena * 2),
    new THREE.MeshStandardMaterial({ color: 0x4a6a4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const factions = new FactionMap();
  factions.setHostile('blue', 'red');

  const pool = new Pool<U>(
    () => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.2, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x6ec8ff }),
      );
      m.visible = false;
      root.add(m);
      return { mesh: m, team: 'blue', hp: new Health({ max: 40 }), alive: false, targetX: 0, targetZ: 0, selected: false };
    },
    (u) => {
      u.alive = false;
      u.mesh.visible = false;
      u.selected = false;
    },
    24,
  );

  for (let i = 0; i < nUnits; i++) {
    const u = pool.acquire();
    u.alive = true;
    u.team = 'blue';
    (u.mesh.material as THREE.MeshStandardMaterial).color.setHex(0x6ec8ff);
    u.mesh.position.set(-arena * 0.5 + i, 0.6, 0);
    u.mesh.visible = true;
    u.targetX = u.mesh.position.x;
    u.targetZ = u.mesh.position.z;
  }
  for (let i = 0; i < nUnits; i++) {
    const u = pool.acquire();
    u.alive = true;
    u.team = 'red';
    (u.mesh.material as THREE.MeshStandardMaterial).color.setHex(0xe07070);
    u.mesh.position.set(arena * 0.5 - i, 0.6, 0);
    u.mesh.visible = true;
    u.targetX = u.mesh.position.x;
    u.targetZ = u.mesh.position.z;
  }

  const score = new Scoreboard();
  const hud = new HudPanel({ id: 'rts-hud', position: 'tl' });
  const endOverlay = new EndOverlay();
  const toast = new Toast();
  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.2, orbit: { distance: 40, height: 32, pitch: 0.85 } });
  void GridAStar;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let status: 'playing' | 'win' | 'lose' = 'playing';

  function pickAt(ev: MouseEvent, select: boolean, move: boolean) {
    const el = document.getElementById('app') ?? document.body;
    const r = el.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = pool.units.filter((u) => u.alive).map((u) => u.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if (select) {
      for (const u of pool.units) u.selected = false;
      if (hits[0]) {
        const u = pool.units.find((x) => x.mesh === hits[0].object && x.team === 'blue');
        if (u) {
          u.selected = true;
          toast.show('选中单位');
        }
      }
    }
    if (move) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, hit)) {
        let n = 0;
        pool.units.forEach((u) => {
          if (u.alive && u.team === 'blue' && u.selected) {
            u.targetX = hit.x + (n % 3) - 1;
            u.targetZ = hit.z + Math.floor(n / 3);
            n++;
          }
        });
        if (n) toast.show('下令移动');
      }
    }
  }

  function onClick(ev: MouseEvent) {
    if (ev.button === 0) pickAt(ev, true, false);
    else if (ev.button === 2) pickAt(ev, false, true);
  }
  function onCtx(ev: MouseEvent) {
    ev.preventDefault();
    pickAt(ev, false, true);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('click', onClick);
    window.addEventListener('contextmenu', onCtx);
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (world.playing && status === 'playing') {
          score.tick(ft);
          let blue = 0;
          let red = 0;
          pool.units.forEach((u) => {
            if (!u.alive) return;
            if (u.team === 'blue') blue++;
            else red++;
            const dx = u.targetX - u.mesh.position.x;
            const dz = u.targetZ - u.mesh.position.z;
            const d = Math.hypot(dx, dz);
            if (d > 0.2) {
              const dir = Steering.normalizeXZ(dx, dz);
              u.mesh.position.x += dir.x * 4 * ft;
              u.mesh.position.z += dir.z * 4 * ft;
            }
            // simple engage
            pool.units.forEach((o) => {
              if (!o.alive || o.team === u.team) return;
              if (!factions.isHostile(u.team, o.team)) return;
              const od = u.mesh.position.distanceTo(o.mesh.position);
              if (od < 2.2 && Math.random() < ft * 0.8) {
                o.hp.damage(8);
                if (!o.hp.alive) {
                  o.alive = false;
                  pool.release(o);
                  score.addKill();
                }
              }
            });
            u.mesh.scale.setScalar(u.selected ? 1.2 : 1);
          });
          if (red <= 0) {
            status = 'win';
            endOverlay.show('蓝方胜利', true);
          } else if (blue <= 0) {
            status = 'lose';
            endOverlay.show('红方胜利', false);
          }
        }
        rig.update(ft, new THREE.Vector3(0, 0, 0), 0.4);
        let blue = 0;
        let red = 0;
        pool.units.forEach((u) => {
          if (u.alive && u.team === 'blue') blue++;
          else if (u.alive) red++;
        });
        hud.setText(`RTS-lite · 蓝 ${blue} · 红 ${red}\n左键选中 · 右键下令`);
      },
    },
  ];

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('click', onClick);
        window.removeEventListener('contextmenu', onCtx);
      }
      scene.remove(root);
      hud.dispose();
      endOverlay.dispose();
      toast.dispose();
    },
    stats: () => ({ status, kills: score.kills }),
  };
}

export function rtsLiteRecipe(opts: RtsLiteRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: 'orbit',
    create: (ctx) => createRtsLiteGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
