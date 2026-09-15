/**
 * Sample — flight (air physics exploration, zero gravity).
 * Thin wrapper around the flight recipe so flight.html and
 * `new-game --recipe flight` share one implementation.
 */
import { flightRecipe } from '../../recipes/flight';

export default flightRecipe({
  id: 'flight',
  title: 'Flight',
});
