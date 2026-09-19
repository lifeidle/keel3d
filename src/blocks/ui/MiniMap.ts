/**
 * MiniMap — north-fixed canvas minimap (generic game-HUD facility).
 *
 * Contract: canvas up = world −z, canvas right = world +x; the arena is
 * centred on the origin (±extent). Content passes colours/layer/markers;
 * the block owns the canvas lifecycle and the per-frame draw.
 *
 * Headless-safe: the mapping is a pure function (worldToMap) and the class
 * DOM-guards (typeof document), so node consumers can unit-test the contract
 * without a browser.
 */

/**
 * Arena/world → map pixel (pure — headless testable).
 * north-fixed: map up = world −z, map right = world +x.
 */
export function worldToMap(
  x: number,
  z: number,
  m: { size: number; extent: number },
): { x: number; y: number } {
  return {
    x: ((x + m.extent) / (2 * m.extent)) * m.size,
    y: ((z + m.extent) / (2 * m.extent)) * m.size,
  };
}

/**
 * Clamp a world point to the map extent (R57 — edge indicators).
 *
 * Gap: off-map entities were skipped entirely (the minimap silently loses
 * threats just beyond the boundary). Conventional minimap behaviour is to
 * pin such dots to the edge. `margin` keeps the dot centre inside the
 * border line. `clamped` is false for points already inside (or on) the
 * extent. Pure — headless testable.
 */
export function clampToWorldExtent(
  x: number,
  z: number,
  extent: number,
  margin = 0.5,
): { x: number; z: number; clamped: boolean } {
  const lim = Math.max(0, extent - margin);
  const cx = Math.max(-lim, Math.min(lim, x));
  const cz = Math.max(-lim, Math.min(lim, z));
  return { x: cx, z: cz, clamped: cx !== x || cz !== z };
}

export interface MiniMapMarker {
  x: number;
  z: number;
  color: string;
  r: number;
}

export interface MiniMapMarkers {
  /** Player position (world) + facing yaw (radians, 0 = −z). */
  player: { x: number; z: number; yaw: number };
  /** Named dot markers (beacons, camps, drops, enemies…). */
  dots: MiniMapMarker[];
}

export interface MiniMapCfg {
  /** Canvas size (px, square). */
  size?: number;
  /** Half-extent of the world shown (units). */
  extent: number;
  /** DOM id for the canvas element. */
  id?: string;
  playerColor?: string;
  bg?: string;
  border?: string;
  /** Crosshair grid colour (quarter marks). */
  grid?: string;
  /** CSS for the canvas (positioning etc.) — content-owned placement. */
  css?: string;
  /**
   * Terrain layer (e.g. TerrainBuilder.terrainShadeCanvas — same size,
   * north-fixed). Drawn over the background, under the dots.
   */
  terrain?: HTMLCanvasElement | null;
  /**
   * R57: pin off-map dots to the edge instead of skipping them (default
   * false — back-compat). Off-map dots are clamped to the extent (with a
   * small margin) and drawn.
   */
  edgeDots?: boolean;
  /** Append to document.body when created (default true). */
  autoAppend?: boolean;
}

const DEFAULTS = {
  size: 150,
  playerColor: '#7ad0ff',
  bg: 'rgba(10,14,20,0.78)',
  border: 'rgba(120,150,190,0.5)',
  grid: 'rgba(120,150,190,0.15)',
};

export class MiniMap {
  readonly canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private cfg: Required<Pick<MiniMapCfg, 'size' | 'extent'>> & MiniMapCfg;
  private playerMap: { x: number; y: number } | null = null;
  private edgeDots = 0;

  constructor(cfg: MiniMapCfg, parent: HTMLElement | null = null) {
    this.cfg = { ...DEFAULTS, ...cfg };
    this.canvas = null;
    this.ctx = null;
    if (typeof document === 'undefined') return;
    const s = this.cfg.size;
    const canvas = document.createElement('canvas');
    if (cfg.id) canvas.id = cfg.id;
    canvas.width = s;
    canvas.height = s;
    if (cfg.css) canvas.style.cssText = cfg.css;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if ((cfg.autoAppend ?? true) && parent === null) {
      document.body.appendChild(canvas);
    } else if (parent) {
      parent.appendChild(canvas);
    }
  }

  /** Per-frame draw: background → terrain layer → frame → grid → dots → player arrow. */
  draw(d: MiniMapMarkers): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const s = this.cfg.size;
    const m = { size: s, extent: this.cfg.extent };
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = this.cfg.bg ?? DEFAULTS.bg;
    ctx.fillRect(0, 0, s, s);
    if (this.cfg.terrain) ctx.drawImage(this.cfg.terrain, 0, 0, s, s);
    // arena frame
    ctx.strokeStyle = this.cfg.border ?? DEFAULTS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(1.5, 1.5, s - 3, s - 3);
    // crosshair grid (quarter marks)
    ctx.strokeStyle = this.cfg.grid ?? DEFAULTS.grid;
    ctx.beginPath();
    ctx.moveTo(s / 2, 0);
    ctx.lineTo(s / 2, s);
    ctx.moveTo(0, s / 2);
    ctx.lineTo(s, s / 2);
    ctx.stroke();

    this.edgeDots = 0;
    const dot = (wx: number, wz: number, color: string, r: number) => {
      let p = worldToMap(wx, wz, m);
      if (p.x < 0 || p.x > s || p.y < 0 || p.y > s) {
        if (!this.cfg.edgeDots) return; // R57: skip (back-compat default)
        const c = clampToWorldExtent(wx, wz, m.extent);
        if (c.clamped) this.edgeDots += 1;
        p = worldToMap(c.x, c.z, m); // pinned to the edge
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const dt of d.dots) dot(dt.x, dt.z, dt.color, dt.r);

    // player arrow (yaw facing; north-fixed — canvas up = −z)
    const p = worldToMap(d.player.x, d.player.z, m);
    this.playerMap = p;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI - d.player.yaw);
    ctx.fillStyle = this.cfg.playerColor ?? DEFAULTS.playerColor;
    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.lineTo(3.5, 4.5);
    ctx.lineTo(0, 2.2);
    ctx.lineTo(-3.5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Last drawn player map position (acceptance hook). */
  get playerMapValue(): { x: number; y: number } | null {
    return this.playerMap;
  }
  /** R57: dots clamped to the edge on the last draw (acceptance hook). */
  get lastEdgeDots(): number {
    return this.edgeDots;
  }

  dispose(): void {
    this.canvas?.remove();
  }
}
