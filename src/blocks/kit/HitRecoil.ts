/**
 * HitRecoil — generic hit flinch / recoil presentation (R51).
 *
 * A hip-pivot-like target is pushed back (`back` u along local +z) and
 * leaned (`lean` rad) on a hit, decaying linearly over `flinchTime`
 * seconds, then snapped back to zero. One source of truth for the
 * flinch presentation — yexi consumes it for both enemies and allies
 * (was hand-rolled in both).
 *
 * Pure state + apply: headless-testable (no DOM, no THREE import).
 */
export interface RecoilTarget {
  position: { z: number };
  rotation: { x: number };
}

export class HitRecoil {
  private t = 0;

  constructor(
    private back: number,
    private lean: number,
    private flinchTime: number,
  ) {
    if (!Number.isFinite(this.flinchTime) || this.flinchTime <= 0) {
      throw new Error('HitRecoil: flinchTime must be finite and > 0');
    }
  }

  /** Fire / retrigger the recoil (refreshes to full strength). */
  flinch(): void {
    this.t = 1;
  }

  /** 0..1 remaining strength (drives hit-flash pulses). */
  get strength(): number {
    return this.t;
  }

  get active(): boolean {
    return this.t > 0;
  }

  /**
   * Advance one frame and apply to a hip-pivot-like target. When the
   * recoil fully decays the pivot is snapped back to zero. Call once per
   * frame while the target is alive.
   */
  update(dt: number, pivot: RecoilTarget): void {
    const f = this.t;
    if (f > 0) {
      pivot.position.z = f * this.back;
      pivot.rotation.x = f * this.lean;
      this.t = Math.max(0, f - dt / this.flinchTime);
    } else if (pivot.position.z !== 0 || pivot.rotation.x !== 0) {
      pivot.position.z = 0;
      pivot.rotation.x = 0;
    }
  }
}
