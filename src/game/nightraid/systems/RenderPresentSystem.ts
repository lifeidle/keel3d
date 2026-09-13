/**
 * Final present + HUD/diag sampling.
 * A3: render call and diagnostics overlay moved out of game.ts.
 */
import type { System } from '../../../engine/types';
import type { Game } from '../game';

export class RenderPresentSystem implements System {
  readonly name = 'nightraid.present';
  private fpsElT = 0;

  constructor(private game: Game) {}

  update(ft: number): void {
    const g = this.game;
    // After WebGPURenderer.init(), three r186 uses the sync render() path
    // (renderAsync is deprecated and raced with rAF — froze the camera).
    g.presentFrame();
    this.sampleDiagnostics(ft);
  }

  private sampleDiagnostics(ft: number): void {
    const g = this.game;
    const inst = ft > 0 ? 1 / ft : 60;
    g.noteFps(inst);
    g.syncRenderScale();

    // transparent FPS readout beside the language toggle (0.5s cadence)
    this.fpsElT -= ft;
    if (this.fpsElT <= 0) {
      this.fpsElT = 0.5;
      const el = document.getElementById('fps-counter');
      if (el) {
        el.textContent = `${g.fpsNow.toFixed(0)} FPS`;
        el.classList.remove('hidden');
      }
    }

    g.noteSlowFrame(ft > 0.25);
    const diagEl = g.diagPanel;
    if (!diagEl || diagEl.style.display === 'none') return;
    const c = g.diagCounts();
    diagEl.textContent =
      `FPS ${g.fpsNow.toFixed(0)}  frame ${(ft * 1000).toFixed(1)}ms\n` +
      `bodies ${c.bodies}  colliders ${c.colliders}\n` +
      `fx ${c.fx}  enemies ${c.enemiesAlive}/${c.enemiesTotal}\n` +
      `state ${c.state}`;
  }
}
