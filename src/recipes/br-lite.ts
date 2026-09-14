/**
 * BR-lite recipe — survive shrinking zone vs bots. 1-player battle royale lite.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { PhysicsWorld } from '../physics/world';
import { CharacterController } from '../blocks/player/CharacterController';
import { CameraRig } from '../blocks/CameraRig';
import { Arsenal } from '../blocks/combat/Arsenal';
import { pickTarget } from '../blocks/combat/Targeting';
import { ShrinkZone } from '../blocks/gameplay/ShrinkZone';
import { Pool } from '../blocks/Pool';
import { Health } from '../blocks/gameplay/Health';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { HudPanel } from '../blocks/ui/HudPanel';
import { HealthBar } from '../blocks/ui/HealthBar';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import type { System, EngineWorld } from '../engine/types';

export interface BrLiteRecipeOpts extends BaseRecipeOpts {
  bots?: number;
  arena?: number;
}

export function createBrLiteGame(
  opts: BrLiteRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const arena = opts.arena ?? 28;
  const nBots = opts.bots ?? 8;

  const physics = new PhysicsWorld({ gravity: -22, fixedDt: 1 / 60, groundSize: arena + 5, floorDepth: 15 });
  physics.addSafetyFloor();
  physics.addStaticBox({ x: 0, y: -0.5, z: 0 }, { x: arena + 2, y: 0.5, z: arena + 2 });

  const root = new THREE.Group();
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 2.2, arena * 2.2),
    new THREE.MeshStandardMaterial({ color: 0x5a6a48 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const zone = new ShrinkZone({ radius: arena * 0.9, minRadius: 5, rate: 0.5, delay: 6 });
  const zoneRing = new THREE.Mesh(
    new THREE.RingGeometry(zone.radius - 0.3, zone.radius, 64),
    new THREE.MeshBasicMaterial({ color: 0x6ec8ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  zoneRing.rotation.x = -Math.PI / 2;
  zoneRing.position.y = 0.05;
  root.add(zoneRing);

  const player = new CharacterController(physics, {
    speed: 7,
    height: 1.6,
    radius: 0.32,
    spawn: new THREE.Vector3(0, 0.1, 0),
  });
  const avatar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x6ec8ff }),
  );
  root.add(avatar);
  player.setMesh(avatar);

  const arsenal = new Arsenal([
    { key: 'smg', magSize: 30, reserve: 90, reloadTime: 1.6, fireRate: 8, auto: true },
  ]);
  const ph = new Health({ max: 100 });
  const score = new Scoreboard();

  interface B {
    mesh: THREE.Mesh;
    hp: number;
    alive: boolean;
  }
  const bots = new Pool<B>(
    () => {
      const m = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.32, 0.9, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0xe07070 }),
      );
      m.visible = false;
      root.add(m);
      return { mesh: m, hp: 0, alive: false };
    },
    (b) => {
      b.alive = false;
      b.mesh.visible = false;
    },
    16,
  );
  for (let i = 0; i < nBots; i++) {
    const b = bots.acquire();
    b.alive = true;
    b.hp = 40;
    const a = (i / nBots) * Math.PI * 2;
    b.mesh.position.set(Math.cos(a) * zone.radius * 0.6, 0.8, Math.sin(a) * zone.radius * 0.6);
    b.mesh.visible = true;
  }

  const hud = new HudPanel({ id: 'br-hud', position: 'tl' });
  const hpBar = new HealthBar({ width: 120, height: 8 });
  if (hpBar.el) {
    hpBar.el.style.cssText += ';position:fixed;left:12px;bottom:12px;z-index:20;';
    document.body.appendChild(hpBar.el);
  }
  const endOverlay = new EndOverlay();
  const toast = new Toast();
  const rig = new CameraRig(camera, { defaultMode: 'shoulder', blend: 0.12 });

  let status: 'playing' | 'win' | 'lose' = 'playing';
  let yaw = 0;
  let fireClicked = false;
  const keys = new Set<string>();
  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') fireClicked = true;
    if (e.code === 'KeyR') arsenal.reload();
  }
  function onUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function onMove(e: MouseEvent) {
    if (typeof document !== 'undefined' && document.pointerLockElement) yaw -= e.movementX * 0.0024;
  }
  function onClick() {
    const el = document.getElementById('app') ?? document.body;
    (el as HTMLElement & { requestPointerLock?: () => void }).requestPointerLock?.();
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onDn);
    window.addEventListener('keyup', onUp);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);
  }

  function shoot() {
    const list = bots.units
      .filter((b) => b.alive)
      .map((b) => ({ x: b.mesh.position.x, z: b.mesh.position.z, alive: true as boolean | undefined, ref: b }));
    const t = pickTarget(player.position.x, player.position.z, list, undefined, {
      range: 30,
      facingX: -Math.sin(yaw),
      facingZ: -Math.cos(yaw),
      minDot: 0.4,
    });
    if (t && 'ref' in t) {
      const b = (t as { ref: B }).ref;
      b.hp -= 12;
      if (b.hp <= 0) {
        b.alive = false;
        bots.release(b);
        score.addKill();
      }
    }
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        const fireHeld = keys.has('Space') || keys.has('KeyJ');
        if (world.playing && status === 'playing') {
          zone.update(ft);
          // ring visual scale
          const k = zone.radius / (arena * 0.9);
          zoneRing.scale.set(k, k, 1);

          let mx = 0;
          let mz = 0;
          if (keys.has('KeyW')) mz -= 1;
          if (keys.has('KeyS')) mz += 1;
          if (keys.has('KeyA')) mx -= 1;
          if (keys.has('KeyD')) mx += 1;
          if (keys.has('ArrowLeft')) yaw += 2 * ft;
          if (keys.has('ArrowRight')) yaw -= 2 * ft;
          player.update(ft, { moveX: mx, moveZ: mz, jump: false }, yaw);
          physics.step();
          player.syncFromPhysics();

          if (!zone.contains(player.position.x, player.position.z)) {
            ph.damage(zone.outsideDps * ft);
            if (!ph.alive) {
              status = 'lose';
              endOverlay.show(`毒圈淘汰 · 击杀 ${score.kills}`, false);
            }
          }

          const outcome = arsenal.update(ft, fireHeld, fireClicked);
          if (outcome === 'fired') shoot();
          fireClicked = false;

          let alive = 0;
          bots.units.forEach((b) => {
            if (!b.alive) return;
            alive++;
            // wander toward zone center if outside
            if (!zone.contains(b.mesh.position.x, b.mesh.position.z)) {
              const dx = -b.mesh.position.x;
              const dz = -b.mesh.position.z;
              const d = Math.hypot(dx, dz) || 1;
              b.mesh.position.x += (dx / d) * 4 * ft;
              b.mesh.position.z += (dz / d) * 4 * ft;
              b.hp -= 3 * ft;
              if (b.hp <= 0) {
                b.alive = false;
                bots.release(b);
              }
            }
          });
          if (alive <= 0 && status === 'playing') {
            status = 'win';
            endOverlay.show(`大吉大利 · 击杀 ${score.kills}`, true);
            toast.show('吃鸡');
          }
          score.tick(ft);
        } else {
          fireClicked = false;
        }
        const eye = player.position.clone();
        eye.y += 1.2;
        rig.update(ft, eye, yaw);
        hpBar.setHp(ph.hp, 100);
        let alive = 0;
        bots.units.forEach((b) => {
          if (b.alive) alive++;
        });
        hud.setText(
          `BR-lite · 存活 ${alive + (ph.alive ? 1 : 0)} · 击杀 ${score.kills} · 半径 ${zone.radius.toFixed(0)}\n` +
            `WASD · 空格射击 · R 换弹 · 蓝圈外掉血`,
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
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('click', onClick);
      }
      player.dispose();
      scene.remove(root);
      hud.dispose();
      hpBar.dispose();
      endOverlay.dispose();
      toast.dispose();
    },
    stats: () => ({ status, kills: score.kills, radius: zone.radius }),
  };
}

export function brLiteRecipe(opts: BrLiteRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: { default: 'shoulder', allow: ['shoulder', 'chase'] },
    create: (ctx) => createBrLiteGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
