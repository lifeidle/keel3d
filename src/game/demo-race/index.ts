/**
 * Sample — race (vehicle physics + looped track, best lap).
 * Thin wrapper around the race recipe so race.html and
 * `new-game --recipe race` share one implementation.
 */
import { raceRecipe } from '../../recipes/race';

export default raceRecipe({
  id: 'race',
  title: 'Race',
  track: [
    { x: -20, y: 0, z: -12 },
    { x: 20, y: 0, z: -12 },
    { x: 24, y: 0, z: 12 },
    { x: -24, y: 0, z: 12 },
    { x: -20, y: 0, z: -12 },
  ],
  speed: 12,
  saveKey: 'keel3d-race-best',
});
