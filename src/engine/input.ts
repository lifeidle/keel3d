// Input: keyboard state, mouse-look deltas, pointer lock, fire/reload intents.
// Pure input layer - no game logic here.

export class Input {
  private keys = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private fireClicked = false; // edge: set on press, consumed by the weapon
  fireDown = false;
  locked = false;
  onReload: (() => void) | null = null;
  onJump: (() => void) | null = null;
  onStart: (() => void) | null = null;
  onWeaponSelect: ((slot: number) => void) | null = null; // 0-based
  onWeaponCycle: ((dir: number) => void) | null = null;
  /** F — board / disembark the driveable tank. */
  onInteract: (() => void) | null = null;
  /** C — toggle tank camera (first person gunner ↔ chase cam). */
  onViewToggle: (() => void) | null = null;
  /** G — throw a signal flare. */
  onFlare: (() => void) | null = null;
  /** X — cycle the squad command (follow / assault / hold). */
  onCommand: (() => void) | null = null;
  /** Left Ctrl HELD — crouch (stand ↔ crouch; prone → crouch). */
  crouchHeld = false;
  /** Z tap — toggle prone. Consumed by the player's stance machine. */
  private proneQueued = false;

  consumeProneToggle(): boolean {
    const q = this.proneQueued;
    this.proneQueued = false;
    return q;
  }
  /** Right mouse button — aim down sights (TOGGLE: press to enter, press
   *  again to leave). Cleared when leaving pointer lock / window blur. */
  adsToggle = false;
  /** M — toggle the full-screen tactical map. */
  onMapToggle: (() => void) | null = null;

  // --- touch input (mobile): merged into the same channels as key/mouse ---
  private touchMove = { x: 0, z: 0, sprint: false };
  private touchLookX = 0;
  private touchLookY = 0;

  private canvas: HTMLElement;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;
    this.bind();
  }

  private bind() {
    window.addEventListener('keydown', (e) => {
      const k = e.code;
      this.keys.add(k);
      if (k === 'KeyR') this.onReload?.();
      if (k === 'Space') {
        e.preventDefault();
        this.onJump?.();
      }
      if (k.startsWith('Digit')) {
        const slot = parseInt(k.slice(5), 10);
        if (slot >= 1 && slot <= 4) this.onWeaponSelect?.(slot - 1);
      }
      if (k === 'KeyQ') this.onWeaponCycle?.(-1);
      if (k === 'KeyE') this.onWeaponCycle?.(1);
      if (k === 'KeyF') this.onInteract?.();
      if (k === 'KeyC') this.onViewToggle?.();
      if (k === 'KeyG') this.onFlare?.();
      if (k === 'KeyX') this.onCommand?.();
      if (k === 'KeyM') this.onMapToggle?.();
      if (k === 'ControlLeft' || k === 'ControlRight') this.crouchHeld = true;
      if (k === 'KeyZ') this.proneQueued = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.crouchHeld = false;
    });
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        this.adsToggle = !this.adsToggle; // toggle aim mode
        e.preventDefault();
        return;
      }
      if (e.button === 0 && this.locked) {
        this.fireDown = true;
        this.fireClicked = true;
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fireDown = false;
    });
    document.addEventListener(
      'wheel',
      (e) => {
        if (!this.locked) return;
        this.onWeaponCycle?.(e.deltaY > 0 ? 1 : -1);
      },
      { passive: true }
    );
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) {
        // leaving combat: drop held fire so nothing stays stuck
        this.fireDown = false;
        this.fireClicked = false;
        this.adsToggle = false;
        this.touchLookX = 0;
        this.touchLookY = 0;
      }
    });
    // alt-tab / window switch can swallow the mouseup — drop everything
    window.addEventListener('blur', () => {
      this.fireDown = false;
      this.fireClicked = false;
      this.adsToggle = false;
    });
  }

  /** Joystick axis, -1..1 on each axis (z: +1 forward). */
  setTouchMove(x: number, z: number, sprint: boolean) {
    this.touchMove.x = x;
    this.touchMove.z = z;
    this.touchMove.sprint = sprint;
  }

  /** Accumulate a look delta from a touch drag (consumed with mouse deltas). */
  addTouchLook(dx: number, dy: number) {
    this.touchLookX += dx;
    this.touchLookY += dy;
  }

  /** Hold-to-fire from the on-screen trigger. */
  setTouchFire(down: boolean) {
    this.fireDown = down;
    if (down) this.fireClicked = true;
  }

  requestLock() {
    // requestPointerLock rejects (uncaught → pageerror) when the gesture
    // requirement isn't met (headless tests, rapid re-locks) — swallow it
    try {
      const r = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch {
      /* lock refused — the player clicks to re-lock */
    }
  }

  /** Returns accumulated mouse delta and resets it. */
  consumeMouse(): { x: number; y: number } {
    const d = { x: this.mouseDX + this.touchLookX, y: this.mouseDY + this.touchLookY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.touchLookX = 0;
    this.touchLookY = 0;
    return d;
  }

  /** True once per left-click press (semi-auto trigger). */
  consumeFireClick(): boolean {
    const c = this.fireClicked;
    this.fireClicked = false;
    return c;
  }

  /** -1 (back) .. 1 (forward) on Z; -1 (left) .. 1 (right) on X. */
  moveAxis(): { x: number; z: number; sprint: boolean } {
    let f = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    let r = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    f += this.touchMove.z;
    r += this.touchMove.x;
    // diagonal + joystick is analog: cap at unit length so diagonals aren't faster
    const len = Math.hypot(f, r);
    if (len > 1) {
      f /= len;
      r /= len;
    }
    const sprint =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchMove.sprint;
    return { x: r, z: f, sprint };
  }

}
