// Physics wrapper around Rapier (compat WASM build — runs without SharedArrayBuffer,
// so it works on Cloudflare Pages AND plain static hosting).
import RAPIER from '@dimforge/rapier3d';
import { CONFIG } from '../config';

export type Vec3 = { x: number; y: number; z: number };

export interface RayHit {
  collider: RAPIER.Collider;
  toi: number;
  point: Vec3;
  normal: Vec3;
}

export class PhysicsWorld {
  readonly RAPIER = RAPIER;
  world: RAPIER.World;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: CONFIG.world.gravity, z: 0 });
    this.world.timestep = CONFIG.world.fixedDt;
  }

  step() {
    this.world.step();
  }

  /**
   * Invisible catch-floor far below the terrain's lowest point. The visible
   * ground is now the terrain trimesh; this only stops anything that escapes
   * (blast knockback, edge cases) from falling forever.
   */
  addSafetyFloor() {
    const h = CONFIG.world.groundSize;
    const y = -(CONFIG.terrain.amplitude + 10);
    const desc = RAPIER.ColliderDesc.cuboid(h, 1, h)
      .setTranslation(0, y - 1, 0)
      .setFriction(0.9)
      .setRestitution(0);
    this.world.createCollider(desc);
  }

  /** Static box obstacle (cover / scenery). Returns the collider so it can be removed later. */
  addStaticBox(pos: Vec3, half: Vec3, friction = 0.8): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setTranslation(pos.x, pos.y, pos.z)
      .setFriction(friction)
      .setRestitution(0);
    return this.world.createCollider(desc);
  }

  createCharacterController(offset: number) {
    const c = this.world.createCharacterController(offset);
    c.setUp({ x: 0, y: 1, z: 0 });
    c.enableAutostep(0.4, 0.2, true);
    c.enableSnapToGround(0.4);
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    c.setMinSlopeSlideAngle((40 * Math.PI) / 180);
    return c;
  }

  /**
   * Returns nearest hit along a ray, or null.
   * `excludeCollider` skips a body so a shooter never hits itself (bullets are
   * fired from inside the shooter's own capsule, so without this the ray would
   * register the shooter's collider first and never reach the target).
   */
  raycast(origin: Vec3, dir: Vec3, maxToi: number, excludeCollider?: RAPIER.Collider): RayHit | null {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxToi, true, undefined, undefined, excludeCollider);
    if (!hit) return null;
    const toi = hit.timeOfImpact;
    const point = {
      x: origin.x + dir.x * toi,
      y: origin.y + dir.y * toi,
      z: origin.z + dir.z * toi,
    };
    return { collider: hit.collider, toi, point, normal: hit.normal };
  }
}
