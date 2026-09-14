// Driveable scout car — fast open-top recon vehicle.
//
// Same driving model as TrackedVehicle (dynamic body steered with setLinvel
// along the heading, rotations locked) but tuned like a light scout: quick
// throttle, tight turning, thin skin. No turret — its value is speed and
// reach, not firepower. The mouse still steers the hull in the FPS style so
// driving feels consistent with the tracked seat.
//
// Block-layer: no game/ imports. Enemy/Audio surfaces are injected via
// VehicleHooks (defined in TrackedVehicle.ts).
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import type { PhysicsWorld } from '../../physics/world';
import { CONFIG } from '../../config';
import type { VehicleHooks, VehicleTarget } from './TrackedVehicle';

/** Pintle MG tuning. Full damage — it's the scout car's only weapon. */
const SCOUT_MG = {
  belt: 100,
  reload: 2.5,
  rate: 9, // rounds / second
  damage: 18,
  range: 140,
};

const J = () => CONFIG.jeep;

/** Open-top scout rig: chassis, hood, windscreen frame, seats, wheels. */
function buildScoutRig(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 0.75, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f2225, roughness: 0.9 });
  const seat = new THREE.MeshStandardMaterial({ color: 0x3a3d33, roughness: 1 });

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };

  box(1.7, 0.5, 3.4, 0, 0.55, 0, body); // chassis tub
  box(1.6, 0.35, 1.2, 0, 0.9, -1.15, body); // hood
  box(1.5, 0.5, 0.5, 0, 1.05, 1.45, body); // rear bin
  // windscreen frame (folded-back look)
  const ws = box(1.5, 0.55, 0.06, 0, 1.35, -0.45, dark);
  ws.rotation.x = -0.25;
  // seats
  box(0.55, 0.5, 0.5, -0.42, 1.0, 0.5, seat);
  box(0.55, 0.5, 0.5, 0.42, 1.0, 0.5, seat);
  // steering wheel
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 14), dark);
  wheel.position.set(-0.42, 1.15, 0.05);
  wheel.rotation.x = -1.1;
  g.add(wheel);
  // spare wheel on the tailgate
  const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 10), dark);
  spare.rotation.x = Math.PI / 2;
  spare.position.set(0, 1.0, 1.75);
  spare.castShadow = true;
  g.add(spare);

  // pintle MG on the passenger seat: post + receiver + barrel + muzzle anchor
  const mg = new THREE.Group();
  const mgMat = new THREE.MeshStandardMaterial({ color: 0x191c1f, roughness: 0.6, metalness: 0.55 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 8), mgMat);
  post.position.set(0, -0.1, 0);
  mg.add(post);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42), mgMat);
  receiver.position.set(0, 0.14, -0.06);
  mg.add(receiver);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.6, 8), mgMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.15, -0.42);
  mg.add(barrel);
  mg.position.set(0.42, 1.3, 0.32);
  mg.traverse((o) => {
    const mm = o as THREE.Mesh;
    if (mm.isMesh) mm.castShadow = true;
  });
  g.add(mg);
  const mgMuzzle = new THREE.Object3D();
  mgMuzzle.position.set(0.42, 1.46, -0.2);
  g.add(mgMuzzle);
  (g as any).mgMuzzle = mgMuzzle;

  // four wheels (visual spin only — the hull glides via setLinvel)
  const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 12);
  const wheels: THREE.Mesh[] = [];
  for (const [wx, wz] of [[-0.85, -1.15], [0.85, -1.15], [-0.85, 1.15], [0.85, 1.15]]) {
    const w = new THREE.Mesh(wg, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  (g as THREE.Group & { wheels?: THREE.Mesh[] }).wheels = wheels;
  return g;
}

export class WheeledVehicle {
  body: RAPIER.RigidBody;
  group: THREE.Group;
  private wheels: THREE.Mesh[] = [];
  private wheelSpin = 0;

  yaw = 0;
  speed = 0; // signed m/s
  hp: number;
  // pintle MG belt
  mgAmmo = SCOUT_MG.belt;
  mgReloadT = 0;
  private mgFireCd = 0;
  private mgMuzzle = new THREE.Object3D();
  readonly maxHp = CONFIG.jeep.hp;
  alive = true;
  driver = false;

  constructor(
    private hooks: VehicleHooks,
    x: number,
    z: number,
    yaw: number
  ) {
    this.hp = J().hp;
    this.yaw = yaw;
    const gy = hooks.terrain.heightAt(x, z);

    this.body = hooks.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, gy + J().colliderHalfH + 0.05, z)
        .lockRotations()
        .setLinearDamping(0.8)
        .setCcdEnabled(true)
    );
    this.hull = hooks.physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(J().colliderHalfH, J().colliderR)
        .setFriction(0.9)
        .setDensity(1.2),
      this.body
    );
    this.body.userData = { type: 'wheeled', wheeled: this };

    this.group = buildScoutRig();
    this.wheels = ((this.group as THREE.Group & { wheels?: THREE.Mesh[] }).wheels ?? []) as THREE.Mesh[];
    this.mgMuzzle = (this.group as any).mgMuzzle as THREE.Object3D;
    this.group.position.set(x, gy, z);
    this.group.rotation.y = yaw;
  }

  hull: RAPIER.Collider;

  attach(scene: THREE.Scene) {
    scene.add(this.group);
  }

  get pos(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get groundY(): number {
    const t = this.body.translation();
    return t.y - J().colliderHalfH;
  }

  /** Bullet / blast damage from the world. Thin-skinned: it burns fast. */
  damage(d: number) {
    if (!this.alive) return;
    this.hp -= d;
    if (this.hp <= 0) this.destroy();
  }

  /** Destroy: explosion, blackened shell, and the driver is ejected by the game. */
  private destroy() {
    this.alive = false;
    this.speed = 0;
    const p = this.pos;
    this.hooks.effects.explosion(new THREE.Vector3(p.x, p.y + 0.5, p.z));
    this.hooks.audio.playExplosion();
    // blacken the wreck in place
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.MeshStandardMaterial).color) {
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.color.multiplyScalar(0.25);
        m.material = mat;
      }
    });
    this.hooks.onWheeledDestroyed?.();
  }

  /**
   * Player driving: mouse steers the hull (FPS style), W/S throttle, A/D turn.
   */
  updatePlayer(
    dt: number,
    move: { x: number; z: number },
    mouse: { x: number; y: number },
    /** Hold to fire the pintle MG along the camera's aim line. */
    fire: boolean,
    camera: THREE.PerspectiveCamera,
    thirdPerson: boolean,
    sensMul: number
  ) {
    if (!this.alive) return;
    const C = CONFIG.jeep;

    const s = CONFIG.player.mouseSensitivity * sensMul;
    this.yaw -= mouse.x * s;

    const fwd = move.z;
    if (fwd > 0.05) this.speed += C.accel * dt;
    else if (fwd < -0.05) this.speed -= C.accel * dt * 0.8;
    else this.speed *= Math.max(0, 1 - dt * 2.6);
    this.speed = THREE.MathUtils.clamp(this.speed, C.maxRev, C.maxSpeed);

    // scouts turn on the spot at low speed and arc at speed
    if (Math.abs(move.x) > 0.05) {
      const grip = THREE.MathUtils.clamp(Math.abs(this.speed) / 4, 0.35, 1);
      // same handedness fix as the tracked vehicle: D (right) subtracts from yaw
      this.yaw -= move.x * C.turnRate * dt * grip * Math.sign(this.speed || 1);
    }

    this.advance(dt);
    this.updateCamera(camera, thirdPerson);
    this.updateMG(dt, fire, camera);
  }

  /** Pintle MG: fires along the camera's aim line from the passenger mount. */
  private updateMG(dt: number, fire: boolean, camera: THREE.PerspectiveCamera) {
    if (this.mgFireCd > 0) this.mgFireCd -= dt;
    if (this.mgReloadT > 0) {
      this.mgReloadT -= dt;
      if (this.mgReloadT <= 0) {
        this.mgAmmo = SCOUT_MG.belt;
        this.hooks.audio.playReload();
      }
      return;
    }
    if (!fire || this.mgFireCd > 0 || this.mgAmmo <= 0) return;

    this.mgFireCd = 1 / SCOUT_MG.rate;
    this.mgAmmo--;
    if (this.mgAmmo <= 0) this.mgReloadT = SCOUT_MG.reload;

    const origin = this.mgMuzzle.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    // recoil spread: dead steady standing still, swinging wide at full speed
    const spread = 0.008 + Math.abs(this.speed) * 0.0038;
    dir.x += (Math.random() - 0.5) * spread * 2;
    dir.y += (Math.random() - 0.5) * spread * 2;
    dir.z += (Math.random() - 0.5) * spread * 2;
    dir.normalize();
    const end = origin.clone().addScaledVector(dir, SCOUT_MG.range);
    const hit = this.hooks.physics.raycast(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
      SCOUT_MG.range,
      this.hull
    );
    const stop = hit
      ? new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z)
      : end;
    this.hooks.effects.tracer(origin, stop);
    this.hooks.effects.muzzle(origin);
    this.hooks.muzzleFlash?.(origin, 4, 18);
    this.hooks.addShake?.(0.05); // light recoil pulse, every round
    this.hooks.audio.playJeepMG();

    if (!hit) return;
    const ud = hit.collider.parent()?.userData as
      | { type?: string; soldier?: { damage: (d: number, p: THREE.Vector3, dir: THREE.Vector3) => void; alive: boolean } }
      | undefined;
    const pt = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
    if (ud?.type === 'enemy' && ud.soldier && ud.soldier.alive) {
      ud.soldier.damage(SCOUT_MG.damage, pt, dir);
    } else {
      this.hooks.effects.spark(pt);
    }
  }

  private advance(dt: number) {
    const vx = -Math.sin(this.yaw) * this.speed;
    const vz = -Math.cos(this.yaw) * this.speed;
    const cur = this.body.linvel();
    this.body.setLinvel({ x: vx, y: cur.y, z: vz }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);

    const tr = this.body.translation();
    const groundY = tr.y - J().colliderHalfH;
    this.group.position.set(tr.x, groundY, tr.z);
    this.group.rotation.y = this.yaw;

    // spin the visual wheels with actual speed
    this.wheelSpin += (this.speed / 0.38) * dt;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;

    // run down infantry at speed (half the tracked lethality, no shell)
    if (Math.abs(this.speed) > 4) {
      for (const e of this.hooks.getEnemies() as VehicleTarget[]) {
        if (!e.alive) continue;
        const ep = e.body.translation();
        if (Math.hypot(ep.x - tr.x, ep.z - tr.z) < 1.6) {
          e.damage(35, new THREE.Vector3(ep.x, ep.y, ep.z), new THREE.Vector3(vx, 0, vz));
        }
      }
    }
  }

  /** Driver's seat (open top, so a low first-person eye) or a snappy chase cam. */
  private updateCamera(camera: THREE.PerspectiveCamera, thirdPerson: boolean) {
    const p = this.pos;
    const cp = this.hooks.terrain.heightAt(p.x, p.z);
    if (!thirdPerson) {
      camera.position.set(p.x, cp + 1.5, p.z);
      camera.rotation.set(0, this.yaw, 0, 'YXZ');
      return;
    }
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    camera.position.set(p.x - fwd.x * 6.5, cp + 3.4, p.z - fwd.z * 6.5);
    const aim = new THREE.Vector3(p.x + fwd.x * 5, cp + 1.0, p.z + fwd.z * 5);
    camera.lookAt(aim);
  }

  dispose(scene: THREE.Scene, physics: PhysicsWorld) {
    scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    physics.world.removeRigidBody(this.body);
  }
}
