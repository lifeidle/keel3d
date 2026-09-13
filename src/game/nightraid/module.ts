/**
 * Sample A module — registry entry + boot helper for the full Night Raid Game.
 * The generic host does not drive Night Raid's menu flow; main.ts calls bootNightRaid.
 */
import { Game } from './game';
import { createNightRaidGame } from './NightRaidGame';
import { defineGame } from '../../content/defineGame';
import type { QualityController } from '../../engine/quality/QualityController';
import type { Engine as ThreeEngine } from '../../engine/renderer';

export default defineGame({
  id: 'nightraid',
  title: 'Night Raid',
  camera: 'fps',
  daylight: false,
  autoPlay: false,
});

export function bootNightRaid(
  app: HTMLElement,
  opts: { qualityCtrl: QualityController; engine: ThreeEngine },
) {
  const game = new Game(app, {
    qualityCtrl: opts.qualityCtrl,
    externalLoop: true,
    engine: opts.engine,
  });
  const module = createNightRaidGame({ game });
  return {
    game,
    systems: module.systems,
    mount(engineHost: Parameters<typeof module.mount>[0]) {
      module.mount(engineHost);
    },
  };
}
