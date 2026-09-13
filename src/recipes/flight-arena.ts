/**
 * Flight-arena recipe — spawn drones, shoot them down, score.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Pool } from '../blocks/Pool';
import { Cooldown } from '../blocks/combat/Cooldown';
import { Projectile, stepProjectiles } from '../blocks/combat/Projectile';
import { pickTarget } from '../blocks/combat/Targeting';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import type { System, EngineWorld } from '../engine/types';

export interface FlightArenaOpts extends BaseRecipeOpts {
  spawnEvery?: number;
  droneHp?: number;
  arena?: number;
}

export function createFlightArena(
  opts: FlightArenaOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const arena = opts.arena ?? 40;
  const spawnEvery = opts.spawnEvery ?? 2.2;
  const droneHp = opts.droneHp ?? 20;

  const root = new THREE.Group();
  scene.add(root);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 20, 12),
    new THREE.MeshBasicMaterial({ color: 0x7eb6e8, side: THREE.BackSide }),
  );
  root.add(sky);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 3, arena * 3),
    new THREE.MeshStandardMaterial({ color: 0x5a8f4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -20;
  root.add(ground);

  const ship = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }),
  );
  ship.rotation.x = Math.PI / 2;
  root.add(ship);

  interface D {
    mesh: THREE.Mesh;
    hp: number;
    alive: boolean;
    phase: number;
  }
  const droneGeo = new THREE.OctahedronGeometry(0.7);
  const droneMat = new THREE.MeshStandardMaterial({ color: 0xc44 });
  const drones = new Pool<D>(
    () => {
      const mesh = new THREE.Mesh(droneGeo, droneMat);
      mesh.visible = false;
      root.add(mesh);
      return { mesh, hp: 0, alive: false, phase: 0 };
    },
    (d) => {
      d.alive = false;
      d.mesh.visible = false;
    },
    10,
  );

  const projectiles: Projectile[] = [];
  const pGeo = new THREE.SphereGeometry(0.12, 6, 6);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  const pMesh = new Map<Projectile, THREE.Mesh>();
  const cd = new Cooldown(0.25);
  const score = new Scoreboard();
  const keys = new Set<string>();
  let spawnT = 0;
  let t = 0;
  let hud: HTMLElement | null = null;
  const rig = new CameraRig(camera, { defaultMode: 'chase', chase: { distance: 10, height: 3, lookAhead: 4 } });

  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') {
      if (cd.tryFire()) {
        const list = drones.units
          .filter((d) => d.alive)
          .map((d) => ({ x: d.mesh.position.x, z: d.mesh.position.z, alive: true as boolean | undefined, ref: d }));
        const target = pickTarget(ship.position.x, ship.position.z, list, undefined, { range: 30 });
        const dx = target ? (target as { ref: D }).ref.mesh.position.x - ship.position.x : 1;
        const dz = target ? (target as { ref: D }).ref.mesh.position.z - ship.position.z : 0;
        const p = new Projectile({
          x: ship.position.x,
          z: ship.position.z,
          dx,
          dz,
          speed: 28,
          damage: 20,
          life: 1.5,
        });
        projectiles.push(p);
        const m = new THREE.Mesh(pGeo, pMat);
        m.position.set(p.x, ship.position.y, p.z);
        root.add(m);
        pMesh.set(p, m);
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
        t += ft;
        if (world.playing) {
          cd.update(ft);
          score.tick(ft);
          spawnT -= ft;
          if (spawnT <= 0) {
            spawnT = spawnEvery;
            const d = drones.acquire();
            d.alive = true;
            d.hp = droneHp;
            d.phase = Math.random() * Math.PI * 2;
            d.mesh.visible = true;
            const ang = Math.random() * Math.PI * 2;
            d.mesh.position.set(Math.cos(ang) * arena * 0.6, 8 + Math.random() * 6, Math.sin(ang) * arena * 0.6);
          }
          // fly ship on XZ
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
            ship.position.x += mx * 12 * ft;
            ship.position.z += mz * 12 * ft;
            ship.rotation.z = -mx * 0.4;
          }
          ship.position.y = 10 + Math.sin(t * 0.8) * 0.5;

          drones.forEachLive((d) => {
            if (!d.alive) return;
            d.phase += ft;
            d.mesh.position.x += Math.cos(d.phase) * ft * 2;
            d.mesh.position.z += Math.sin(d.phase * 0.7) * ft * 2;
            d.mesh.rotation.y += ft * 2;
          });

          const targets = drones.units
            .filter((d) => d.alive)
            .map((d) => ({ x: d.mesh.position.x, z: d.mesh.position.z, radius: 0.8, alive: true, ref: d }));
          const hits = stepProjectiles(projectiles, targets, ft, 0.5);
          for (const h of hits) {
            const d = h.target as D;
            d.hp -= h.damage;
            if (d.hp <= 0) {
              d.alive = false;
              drones.release(d);
              score.addKill();
            }
          }
          for (const [p, m] of pMesh) {
            if (!p.alive) {
              m.visible = false;
              pMesh.delete(p);
            } else m.position.set(p.x, ship.position.y, p.z);
          }
        }
        rig.update(ft, ship.position, Math.PI / 2);

        if (!hud && typeof document !== 'undefined') {
          hud = document.createElement('div');
          hud.id = 'flight-hud';
          hud.style.cssText =
            'position:fixed;left:12px;top:12px;z-index:20;color:#e8eef7;font:14px/1.5 monospace;background:rgba(0,0,0,.5);padding:10px 14px;border-radius:8px;pointer-events:none;white-space:pre';
          document.body.appendChild(hud);
        }
        if (hud) hud.textContent = `击落 ${score.kills} · WASD 飞行 · 空格/J 射击`;
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
    },
    stats: () => ({ kills: score.kills }),
  };
}

export function flightArenaRecipe(opts: FlightArenaOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: { default: 'chase', allow: ['chase', 'orbit'] },
    create: (ctx) => createFlightArena(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
