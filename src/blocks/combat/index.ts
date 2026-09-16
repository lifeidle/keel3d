export { Cooldown } from './Cooldown';
export { pickTarget, type TargetCandidate, type TargetMode, type TargetOpts } from './Targeting';
export {
  Projectile,
  stepProjectiles,
  type ProjectileOpts,
  type ProjectileHit,
  type HitTestTarget,
} from './Projectile';
export { areaHits, ringHits, type AreaTarget, type AreaResult } from './AreaDamage';
export { blastHits, DEFAULT_BLAST, type BlastTarget, type BlastConfig, type BlastHit } from './Blast';
export { ArcProjectile, arcVelocityToward, type ArcOpts } from './ArcProjectile';
export { Magazine } from './Magazine';
export {
  Arsenal,
  type ArsenalSlotDef,
  type ArsenalOpts,
  type FireOutcome,
} from './Arsenal';
