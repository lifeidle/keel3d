/**
 * PropFollower — attach a static prop hulk to a moving unit (R90).
 *
 * Gap: hulk visuals (VehicleHulk props) are authored STATIC at their spawn
 * ground height, but their owners move (drivable tanks, enemy vehicles).
 * Content that syncs `group.position` by hand must re-derive the y
 * compensation (children ride the hulk's SPAWN ground height, so at a new
 * terrain height h the group sits at `h − baseY`) and decide whether to
 * override the authored yaw — one shared form keeps the math in one place.
 */
import * as THREE from 'three';

export class PropFollower {
  constructor(
    public group: THREE.Group,
    private baseY: number,
  ) {
    if (!Number.isFinite(baseY)) throw new Error('PropFollower: baseY must be finite');
  }

  /**
   * Place the hulk at (x, z): `group.y = heightAt(x, z) − baseY` (children
   * were authored at the hulk's spawn ground height). `yaw` overrides the
   * hulk's yaw when given — OMIT it to keep the current (e.g. authored)
   * yaw while only the position follows.
   */
  update(
    x: number,
    z: number,
    heightAt: (x: number, z: number) => number,
    yaw?: number,
  ): void {
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      throw new Error('PropFollower: x/z must be finite');
    }
    if (yaw !== undefined && !Number.isFinite(yaw)) {
      throw new Error('PropFollower: yaw must be finite when given');
    }
    this.group.position.set(x, heightAt(x, z) - this.baseY, z);
    if (yaw !== undefined) this.group.rotation.y = yaw;
  }
}
