/**
 * Flight recipe — zero-gravity auto-flight demo (exploration / camera feel).
 *
 * The demo version (src/game/demo-flight) circles a point with a vertical
 * bob. The recipe parameterizes the flight loop and scenery so it can be
 * reused as an "air physics" starter. For combat flight use flight-arena.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { HudPanel } from '../blocks/ui/HudPanel';
import type { System, EngineWorld } from '../engine/types';

export interface FlightRecipeOpts extends BaseRecipeOpts {
  /** Horizontal circle radius. */
  radius?: number;
  /** Base altitude (Y). */
  altitude?: number;
  /** Vertical bob amplitude. */
  bob?: number;
  /** Orbit angular speed (rad/s). */
  orbitSpeed?: number;
  /** Bob angular speed (rad/s). */
  bobSpeed?: number;
  planeColor?: number;
  skyColor?: number;
  groundColor?: number;
  /** Ground plane Y (far below the flight path). */
  groundY?: number;
  /** Chase camera distance. */
  camDistance?: number;
}

export function createFlightGame(
  opts: FlightRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const r = opts.radius ?? 30;
  const altitude = opts.altitude ?? 10;
  const bob = opts.bob ?? 4;
  const orbitSpeed = opts.orbitSpeed ?? 0.4;
  const bobSpeed = opts.bobSpeed ?? 0.7;

  const root = new THREE.Group();
  scene.add(root);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 24, 16),
    new THREE.MeshBasicMaterial({ color: opts.skyColor ?? 0x7eb6e8, side: THREE.BackSide }),
  );
  root.add(sky);

  const plane = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 2.8, 6),
    new THREE.MeshStandardMaterial({ color: opts.planeColor ?? 0xf0f0f0, metalness: 0.3, roughness: 0.4 }),
  );
  plane.rotation.x = Math.PI / 2;
  plane.castShadow = true;
  root.add(plane);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: opts.groundColor ?? 0x6a9a48 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = opts.groundY ?? -40;
  root.add(ground);

  const rig = new CameraRig(camera, {
    defaultMode: 'chase',
    chase: { distance: opts.camDistance ?? 10, height: 3, lookAhead: 4 },
  });

  const hud = new HudPanel({ id: 'flight-hud', position: 'tl' });
  let t = 0;

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (world.playing) t += ft;
        plane.position.set(
          Math.cos(t * orbitSpeed) * r,
          altitude + Math.sin(t * bobSpeed) * bob,
          Math.sin(t * orbitSpeed) * r,
        );
        const yaw = t * orbitSpeed + Math.PI / 2;
        plane.rotation.z = Math.sin(t * bobSpeed) * 0.3;
        rig.update(ft, plane.position, yaw);
        hud.setText(
          `飞行 · physics air · gravity 0 · 高度 ${plane.position.y.toFixed(1)} · t ${t.toFixed(1)}s`,
        );
      },
    },
  ];

  return {
    systems,
    dispose() {
      scene.remove(root);
      hud.dispose();
    },
    stats: () => ({
      x: plane.position.x,
      y: plane.position.y,
      z: plane.position.z,
      time: t,
    }),
  };
}

export function flightRecipe(opts: FlightRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    camera: 'chase',
    map: { kind: 'seeded', gen: (seed) => ({ seed, sky: true }) },
    create: (ctx) => createFlightGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
