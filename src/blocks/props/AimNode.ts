/**
 * AimNode — rate-limited yaw seeking for prop sub-nodes (R89). Pure state.
 *
 * Gap: turret/gun sub-nodes that must track a target (a tank turret
 * following the player's aim, a watchtower tracking an intruder) need
 * SHORT-EST-PATH, RATE-LIMITED yaw seeking. Content that rolls its own
 * wrap math repeatedly takes the long way around (or overshoots) — this
 * is the shared form.
 */
export class AimNode {
  private yaw: number;
  private target: number;
  constructor(private rate = 2.5, yaw = 0) {
    if (!(rate > 0) || !Number.isFinite(rate)) {
      throw new Error('AimNode: rate must be finite and > 0');
    }
    this.yaw = yaw;
    this.target = yaw;
  }

  /** Set the target yaw (radians, any magnitude — wrapped on update). */
  aimAt(target: number): void {
    if (!Number.isFinite(target)) throw new Error('AimNode: target must be finite');
    this.target = target;
  }

  /**
   * Turn toward the target at the rate limit. `rate` overrides the
   * constructor rate for this step (a snappy in-hand aim vs a slow
   * idle watch use the SAME node). Returns the current yaw.
   */
  update(dt: number, rate?: number): number {
    if (!(dt >= 0) || !Number.isFinite(dt)) {
      throw new Error('AimNode: dt must be finite and >= 0');
    }
    const r = rate ?? this.rate;
    if (!(r > 0) || !Number.isFinite(r)) {
      throw new Error('AimNode: rate must be finite and > 0');
    }
    let d = this.target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest path, -π..π
    const max = r * dt;
    if (d > max) d = max;
    else if (d < -max) d = -max;
    this.yaw += d;
    if (this.yaw > Math.PI) this.yaw -= 2 * Math.PI;
    else if (this.yaw < -Math.PI) this.yaw += 2 * Math.PI;
    return this.yaw;
  }

  get current(): number {
    return this.yaw;
  }

  /** Within 0.01 rad of the target (turning done). */
  get settled(): boolean {
    let d = this.target - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return Math.abs(d) < 0.01;
  }

  reset(yaw: number): void {
    this.yaw = yaw;
    this.target = yaw;
  }
}
