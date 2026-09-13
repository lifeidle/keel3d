// Gyroscope aiming (mobile): turn device motion into look deltas.
//
// Design notes:
// - DELTA-based, not absolute pose. The device's absolute orientation has no
//   relationship to where the player wants to look; only *changes* matter.
//   Subtracting consecutive readings also cancels any mounting-angle offset.
// - alpha (compass heading) is deliberately ignored — it drifts and couples the
//   view to magnetic north.
// - Screen orientation changes which axis is "turn left" vs "look up", so the
//   beta/gamma pair is remapped by screen.orientation.angle.
// - iOS 13+ requires an explicit permission prompt that MUST run inside a user
//   gesture, so enable() is only ever called from the settings toggle.
// - The sign conventions below match the standard landscape-FPS layout; if a
//   device ever feels inverted, flip GYRO_SIGN rather than the mapping.

/** Degrees of device rotation -> look input, tuned for a ~30° wrist turn to
 *  sweep roughly a quarter screen. The settings slider scales this further. */
export const GYRO_GAIN = 0.055;

/** Ignore tiny rotations — hand tremor must not drift the aim. */
const DEAD_ZONE = 0.035;

export class GyroAim {
  private listening = false;
  private last: { beta: number; gamma: number } | null = null;
  private handler = (e: DeviceOrientationEvent) => this.onEvent(e);
  /** Settings multiplier on top of GYRO_GAIN (0.3-2.0). */
  gainMult = 1;

  /** iOS 13+ gates the API behind a user-gesture permission prompt. */
  static permissionNeeded(): boolean {
    const d = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    return typeof d?.requestPermission === 'function';
  }

  static supported(): boolean {
    return typeof DeviceOrientationEvent !== 'undefined';
  }

  /**
   * Start listening. Resolves true when actually running — false on denial
   * (iOS prompt rejected) or unsupported hardware.
   */
  async enable(): Promise<boolean> {
    if (!GyroAim.supported()) return false;
    if (GyroAim.permissionNeeded()) {
      try {
        const d = DeviceOrientationEvent as unknown as {
          requestPermission: () => Promise<'granted' | 'denied'>;
        };
        if (await d.requestPermission() !== 'granted') return false;
      } catch {
        return false; // prompt dismissed or a security error
      }
    }
    if (!this.listening) {
      this.listening = true;
      this.last = null; // re-baseline so enabling doesn't jerk the view
      window.addEventListener('deviceorientation', this.handler);
    }
    return true;
  }

  disable() {
    if (!this.listening) return;
    this.listening = false;
    this.last = null;
    window.removeEventListener('deviceorientation', this.handler);
  }

  get active() {
    return this.listening;
  }

  private onEvent(e: DeviceOrientationEvent) {
    if (e.beta == null || e.gamma == null) return;
    const prev = this.last;
    this.last = { beta: e.beta, gamma: e.gamma };
    if (!prev) return; // first reading only sets the baseline

    // degrees of rotation since the last event
    let dBeta = e.beta - prev.beta;
    let dGamma = e.gamma - prev.gamma;
    // wrap-around guards (beta crosses ±180 when flipping the device)
    if (dBeta > 180) dBeta -= 360;
    if (dBeta < -180) dBeta += 360;

    // remap to the current screen orientation
    const angle =
      (typeof screen !== 'undefined' && screen.orientation?.angle) ||
      (window as unknown as { orientation?: number }).orientation ||
      0;
    let dx: number; // positive = turn right (matches mouse dx)
    let dy: number; // positive = look down (matches mouse dy)
    if (angle === 90) {
      dx = dBeta;
      dy = dGamma;
    } else if (angle === 270 || angle === -90) {
      dx = -dBeta;
      dy = -dGamma;
    } else if (angle === 180) {
      dx = -dGamma;
      dy = -dBeta;
    } else {
      // portrait
      dx = -dGamma;
      dy = dBeta;
    }

    // dead zone per axis, then scale
    if (Math.abs(dx) < DEAD_ZONE) dx = 0;
    if (Math.abs(dy) < DEAD_ZONE) dy = 0;
    if (dx === 0 && dy === 0) return;
    this.onLook?.(dx * GYRO_GAIN * this.gainMult, dy * GYRO_GAIN * this.gainMult);
  }

  /** Wired by the game to Input.addTouchLook so gyro rides the touch channel. */
  onLook: ((dx: number, dy: number) => void) | null = null;
}
