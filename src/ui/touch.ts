// Night Raid mobile touch controls — a thin adapter over the generic
// blocks/input/TouchControls core (joystick + look + gyro live there now).
// The TouchSink surface and the class API used by game.ts are unchanged.

import {
  TouchControls as TouchCore,
  type ActionButtonDef,
} from '../blocks/input/TouchControls';

export { isTouchDevice } from '../blocks/input/TouchControls';

export interface TouchSink {
  setTouchMove(x: number, z: number, sprint: boolean): void;
  addTouchLook(dx: number, dy: number): void;
  setTouchFire(down: boolean): void;
  reload(): void;
  jump(): void;
  swap(): void;
  interact(): void;
  flare(): void;
  pause(): void;
}

export class TouchControls extends TouchCore {
  constructor(sink: TouchSink) {
    const buttons: ActionButtonDef[] = [
      {
        id: 'fire',
        label: 'FIRE',
        kind: 'hold',
        size: 84,
        onDown: () => sink.setTouchFire(true),
        onUp: () => sink.setTouchFire(false),
      },
      { id: 'jump', label: 'JUMP', kind: 'tap', size: 56, onDown: () => sink.jump(), onUp: () => {} },
      { id: 'reload', label: 'RELOAD', kind: 'tap', size: 56, onDown: () => sink.reload(), onUp: () => {} },
      { id: 'swap', label: 'SWAP', kind: 'tap', size: 52, onDown: () => sink.swap(), onUp: () => {} },
      { id: 'use', label: 'USE', kind: 'tap', size: 52, onDown: () => sink.interact(), onUp: () => {} },
      { id: 'flare', label: 'FLARE', kind: 'tap', size: 46, onDown: () => sink.flare(), onUp: () => {} },
      { id: 'pause', label: 'II', kind: 'tap', size: 38, onDown: () => sink.pause(), onUp: () => {} },
    ];
    super(
      {
        setMove: (x, z, s) => sink.setTouchMove(x, z, s),
        addLook: (dx, dy) => sink.addTouchLook(dx, dy),
        setFire: (down) => sink.setTouchFire(down),
      },
      buttons
    );
  }
}
