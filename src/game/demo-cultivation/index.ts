/**
 * Sample C — demo-cultivation (open world, multi-camera, goal chain).
 * Thin wrapper around the openworld recipe so openworld.html and
 * `new-game --recipe openworld` share one implementation.
 *
 * Goal chain: figure-8 patrol auto-collects spirit orbs, cultivates on the
 * central dais (筑基 breakthrough), and a swarm of beasts gathers — all done
 * = win (cultivation ×2).
 */
import { openworldRecipe } from '../../recipes/open';

export default openworldRecipe({
  id: 'cultivation',
  title: 'Cultivation',
});
