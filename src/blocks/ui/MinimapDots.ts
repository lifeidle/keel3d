/**
 * MinimapDots — legacy name, superseded by {@link MiniMap} (R45).
 * Kept as a thin wrapper for backward compatibility (public lib export;
 * the dungeon recipe now uses MiniMap directly).
 */
import { MiniMap } from './MiniMap';

export interface MapDot {
  x: number;
  z: number;
  color?: string;
}

export class MinimapDots extends MiniMap {
  constructor(opts: { size?: number; worldHalf?: number } = {}) {
    super({
      size: opts.size ?? 120,
      extent: opts.worldHalf ?? 40,
      playerColor: '#6ec8ff',
      css:
        'position:fixed;right:12px;top:12px;z-index:20;border:1px solid rgba(255,255,255,.25);' +
        'border-radius:8px;background:rgba(0,0,0,.45)',
    });
  }

  /** Legacy API — world XZ dots + player centre marker. */
  render(dots: readonly MapDot[], playerX: number, playerZ: number): void {
    this.draw({
      player: { x: playerX, z: playerZ, yaw: 0 },
      dots: dots.map((d) => ({ x: d.x, z: d.z, color: d.color ?? '#ffd27a', r: 3 })),
    });
  }
}
