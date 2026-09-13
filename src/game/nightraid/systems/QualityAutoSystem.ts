/**
 * Sustained-low-fps tier downgrade (after dynamic render-scale).
 * A2: logic moved out of game.ts; timer state lives on the system.
 */
import type { System, EngineWorld } from '../../../engine/types';
import type { Quality } from '../../../world/quality';
import { t } from '../../../i18n';
import type { Game } from '../game';

export class QualityAutoSystem implements System {
  readonly name = 'nightraid.quality-auto';
  private lowFpsTime = 0;
  private autoDowngraded = false;

  constructor(private game: Game) {}

  update(ft: number, world: EngineWorld): void {
    if (!world.playing) return;
    const g = this.game;
    if (this.autoDowngraded || g.qualityTier === 'low') return;
    if (g.fpsNow < 26) this.lowFpsTime += ft;
    else this.lowFpsTime = Math.max(0, this.lowFpsTime - ft * 0.5); // brief stutters heal
    if (this.lowFpsTime < 6) return;
    this.autoDowngraded = true;
    const next: Quality = g.qualityTier === 'high' ? 'med' : 'low';
    g.applyQuality(next);
    document.querySelectorAll<HTMLElement>('.qualBtn').forEach((b) =>
      b.classList.toggle('sel', b.dataset.q === next),
    );
    g.hudView.showHint(t('hint.autoQuality'), 4);
  }
}
