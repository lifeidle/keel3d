// Pure ballistics helpers — no THREE / Rapier, so they unit-test cleanly.

/**
 * Linear blast falloff: full damage (1) at the centre, tapering to `edgeFrac`
 * at the blast radius, and 0 beyond it. Mirrors how BarrelManager.detonate
 * scales radial damage to enemies and the player.
 */
export function blastFalloff(distance: number, radius: number, edgeFrac: number): number {
  if (distance > radius) return 0;
  return 1 - (distance / radius) * (1 - edgeFrac);
}
