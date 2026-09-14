/**
 * Combat-arena recipe — hover tank vs drones. WASD drive, Space cannon, K AOE.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { Arsenal } from '../blocks/combat/Arsenal';
import { pickTarget } from '../blocks/combat/Targeting';
import { areaHits } from '../blocks/combat/AreaDamage';
import { Pool } from '../blocks/Pool';
import { Health } from '../blocks/gameplay/Health';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { Gamepad } from '../blocks/input/Gamepad';
import { HudPanel } from '../blocks/ui/HudPanel';
import { HealthBar } from '../blocks/ui/HealthBar';
import { DamageNumbers } from '../blocks/ui/DamageNumber';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { GameFeel } from '../blocks/fx/GameFeel';
import { KitSfx } from '../blocks/audio/KitSfx';
import type { System, EngineWorld } from '../engine/types';

export interface CombatArenaRecipeOpts extends BaseRecipeOpts {
  arena?: number;
  playerHp?: number;
  droneHp?: number;
}

export function createCombatArenaGame(
  opts: CombatArenaRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const arena = opts.arena ?? 26;

  const root = new THREE.Group();
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(arena * 2, arena * 2),
    new THREE.MeshStandardMaterial({ color: 0x3a4038 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const tank = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.7, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x55603f, metalness: 0.3 }),
  );
  hull.position.y = 0.6;
  hull.castShadow = true;
  tank.add(hull);
  const turret = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.5, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x3f4a33 }),
  );
  turret.position.y = 1.15;
  tank.add(turret);
  root.add(tank);

  const arsenal = new Arsenal([
    { key: 'cannon', magSize: 8, reserve: 24, reloadTime: 2.2, fireRate: 1.2, auto: false },
  ]);
  const playerHp = new Health({ max: opts.playerHp ?? 150 });
  const score = new Scoreboard();
  const pad = new Gamepad();
  const hud = new HudPanel({ id: 'arena-hud', position: 'tl' });
  const hpBar = new HealthBar({ width: 140, height: 8 });
  if (hpBar.el) {
    hpBar.el.style.cssText += ';position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:20;';
    document.body.appendChild(hpBar.el);
  }
  const dmgNums = new DamageNumbers();
  const endOverlay = new EndOverlay();
  const feel = new GameFeel();
  const sfx = new KitSfx();
  const KILL_GOAL = 10;
  const rig = new CameraRig(camera, { defaultMode: 'chase', blend: 0.15, chase: { distance: 12, height: 5, lookAhead: 4 } });

  interface D {
    mesh: THREE.Mesh;
    hp: number;
    alive: boolean;
  }
  const drones = new Pool<D>(
    () => {
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        new THREE.MeshStandardMaterial({ color: 0xe07070 }),
      );
      m.visible = false;
      root.add(m);
      return { mesh: m, hp: 0, alive: false };
    },
    (d) => {
      d.alive = false;
      d.mesh.visible = false;
    },
    10,
  );

  let status: 'playing' | 'win' | 'lose' = 'playing';
  let yaw = 0;
  let spawnT = 1;
  let fireClicked = false;
  let aoeClicked = false;
  const keys = new Set<string>();
  const tankPos = new THREE.Vector3(0, 0, 0);
  const tankSpeed = { v: 0 };

  function onDn(e: KeyboardEvent) {
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyJ') fireClicked = true;
    if (e.code === 'KeyK') aoeClicked = true;
    if (e.code === 'KeyR' && status !== 'playing' && typeof location !== 'undefined') location.reload();
  }
  function onUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function onMove(e: MouseEvent) {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      yaw -= e.movementX * 0.0025;
    }
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

  function fire() {
    const list = drones.units
      .filter((d) => d.alive)
      .map((d) => ({ x: d.mesh.position.x, z: d.mesh.position.z, alive: true as boolean | undefined, ref: d }));
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const t = pickTarget(tankPos.x, tankPos.z, list, undefined, { range: 28, facingX: fx, facingZ: fz, minDot: 0.3 });
    if (t && 'ref' in t) {
      const d = (t as { ref: D }).ref;
      d.hp -= 30;
      const v = d.mesh.position.clone().project(camera);
      dmgNums.spawn((v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, '30');
      if (d.hp <= 0) {
        d.alive = false;
        drones.release(d);
        score.addKill();
        sfx.play('hit');
        if (score.kills >= KILL_GOAL && status === 'playing') {
          status = 'win';
          sfx.play('win');
          endOverlay.show(`胜利！击落 ${score.kills} 架 — 按 R 再来`, true);
        }
      }
    }
  }

  function aoe() {
    const list = drones.units.map((d) => ({
      x: d.mesh.position.x,
      z: d.mesh.position.z,
      alive: d.alive,
      ref: d,
    }));
    for (const h of areaHits(tankPos.x, tankPos.z, 7, list)) {
      const d = h.target.ref as D;
      if (d.alive) {
        d.hp -= 25;
        if (d.hp <= 0) {
          d.alive = false;
          drones.release(d);
          score.addKill();
        }
      }
    }
  }

  function spawn() {
    const d = drones.acquire();
    d.alive = true;
    d.hp = opts.droneHp ?? 30;
    const ang = Math.random() * Math.PI * 2;
    d.mesh.position.set(Math.cos(ang) * arena * 0.7, 1, Math.sin(ang) * arena * 0.7);
    d.mesh.visible = true;
  }

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        pad.poll();
        const fireHeld = keys.has('Space') || keys.has('KeyJ') || pad.fire;
        if (world.playing && status === 'playing') {
          yaw += pad.lookX * 2 * ft;
          if (keys.has('ArrowLeft')) yaw += 1.8 * ft;
          if (keys.has('ArrowRight')) yaw -= 1.8 * ft;
          let throttle = 0;
          if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1;
          if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1;
          throttle += -pad.moveY;
          throttle = Math.max(-1, Math.min(1, throttle));
          tankSpeed.v = throttle * 9;
          tankPos.x += -Math.sin(yaw) * tankSpeed.v * ft;
          tankPos.z += -Math.cos(yaw) * tankSpeed.v * ft;
          tankPos.x = THREE.MathUtils.clamp(tankPos.x, -arena, arena);
          tankPos.z = THREE.MathUtils.clamp(tankPos.z, -arena, arena);
          tank.position.set(tankPos.x, 0, tankPos.z);
          tank.rotation.y = yaw;

          const outcome = arsenal.update(ft, fireHeld, fireClicked);
          if (outcome === 'fired') fire();
          fireClicked = false;
          if (aoeClicked) {
            aoe();
            aoeClicked = false;
          }

          spawnT -= ft;
          if (spawnT <= 0) {
            spawnT = 2.4;
            spawn();
          }

          drones.units.forEach((d) => {
            if (!d.alive) return;
            const dx = tankPos.x - d.mesh.position.x;
            const dz = tankPos.z - d.mesh.position.z;
            const dist = Math.hypot(dx, dz);
            d.mesh.position.y = 1 + Math.sin(performance.now() / 400 + dist) * 0.2;
            if (dist > 1.8 && dist < 30) {
              d.mesh.position.x += (dx / dist) * 3.5 * ft;
              d.mesh.position.z += (dz / dist) * 3.5 * ft;
            } else if (dist <= 1.8 && Math.random() < ft) {
              playerHp.damage(6);
              if (!playerHp.alive) {
                status = 'lose';
                endOverlay.show(`载具被毁 — 击杀 ${score.kills}`, false);
              }
            }
          });
        } else {
          fireClicked = false;
          aoeClicked = false;
        }
        rig.update(ft, tankPos, yaw);
        hpBar.setHp(playerHp.hp, opts.playerHp ?? 150);
        const ammo = arsenal.reloading ? '装填…' : `${arsenal.mag}/${arsenal.reserve}`;
        hud.setText(
          `载具对战 · 击杀 ${score.kills} · 敌机 ${drones.activeCount} · HP ${playerHp.hp}\n` +
            `目标 ${KILL_GOAL} · WASD 驾驶 · 空格/J 主炮 · K 冲击 · ${ammo}`,
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
      scene.remove(root);
      hud.dispose();
      hpBar.dispose();
      dmgNums.dispose();
      endOverlay.dispose();
      feel.dispose();
      sfx.dispose();
    },
    stats: () => ({ kills: score.kills, hp: playerHp.hp, status }),
  };
}

export function combatArenaRecipe(opts: CombatArenaRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: true,
    autoPlay: true,
    camera: { default: 'chase', allow: ['chase', 'orbit'] },
    create: (ctx) => createCombatArenaGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
