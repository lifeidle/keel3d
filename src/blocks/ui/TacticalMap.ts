// TacticalMap: HUD compass tape + circular minimap (both canvas).
// The minimap is player-centric and rotates with heading (facing = up);
// obstacles always show, enemy blips appear when they recently fired or are
// close. The compass tape shows bearing ticks plus enemy fire pings.
//
// Block-layer: no game/ imports. Contacts are flat world-space points.
import { CONFIG } from '../../config';
import { getLocale } from '../../i18n';

/** Flat world-space contact for the tactical UIs. */
export interface MapContact {
  x: number;
  z: number;
  /** 'ally' | 'hostile' — default hostile. */
  team?: string;
  /** false/undefined skips the blip. */
  alive?: boolean;
  downed?: boolean;
  /** Special class for color/size (e.g. 'rpg', 'lmg'). */
  classKey?: string;
  /** Last shot time in seconds (performance.now()/1000); drives fire pings. */
  lastShot?: number;
}

/** Axis-aligned obstacle footprint (satisfied by mapgen MapObstacle). */
export interface MapObstacleRect {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

const VIEW_M = 40; // minimap view radius (meters)
const PING_S = 2.5; // seconds an enemy fire ping stays visible

const DIRS_ZH = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
const DIRS_EN = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Exfiltration zone marker (extract missions only). */
export interface ExfilBlip {
  x: number;
  z: number;
  active: boolean; // lit once the area is cleared
}

export class TacticalMap {
  private mini = document.getElementById('minimap') as HTMLCanvasElement;
  private comp = document.getElementById('compass') as HTMLCanvasElement;
  private mctx = this.mini.getContext('2d')!;
  private cctx = this.comp.getContext('2d')!;

  show(v: boolean) {
    this.mini.classList.toggle('hidden', !v);
    this.comp.classList.toggle('hidden', !v);
  }

  update(
    px: number,
    pz: number,
    yaw: number,
    enemies: MapContact[],
    obstacles: MapObstacleRect[],
    half: number,
    barrels: Array<{ x: number; z: number }> = [],
    exfil: ExfilBlip | null = null,
    dumps: Array<{ x: number; z: number; used: boolean }> = []
  ) {
    this.drawCompass(px, pz, yaw, enemies);
    this.drawMinimap(px, pz, yaw, enemies, obstacles, half, barrels, exfil, dumps);
  }

  // ---------- compass tape ----------

  private drawCompass(px: number, pz: number, yaw: number, enemies: MapContact[]) {
    const W = 360;
    const H = 34;
    const c = this.cctx;
    c.setTransform(2, 0, 0, 2, 0, 0); // 2x backing store
    c.clearRect(0, 0, W, H);

    const heading = (((-yaw * 180) / Math.PI) % 360 + 360) % 360;
    const pxPerDeg = 2.2;
    const halfSpan = W / pxPerDeg / 2; // degrees visible each side
    const dirs = getLocale() === 'zh' ? DIRS_ZH : DIRS_EN;

    // backdrop
    c.fillStyle = 'rgba(6, 10, 18, 0.45)';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(148, 178, 210, 0.18)';
    c.strokeRect(0.5, 0.5, W - 1, H - 1);

    // ticks + labels
    const start = Math.ceil((heading - halfSpan) / 15) * 15;
    const end = heading + halfSpan;
    c.textAlign = 'center';
    for (let d = start; d <= end; d += 15) {
      const x = W / 2 + (d - heading) * pxPerDeg;
      const norm = ((d % 360) + 360) % 360;
      const major = norm % 45 === 0;
      c.strokeStyle = major ? 'rgba(184, 204, 216, 0.9)' : 'rgba(148, 178, 210, 0.35)';
      c.beginPath();
      c.moveTo(x, major ? H - 15 : H - 9);
      c.lineTo(x, H - 3);
      c.stroke();
      if (major) {
        c.fillStyle = 'rgba(216, 224, 232, 0.92)';
        c.font = '11px "Segoe UI", system-ui, sans-serif';
        c.fillText(dirs[norm / 45], x, 13);
      }
    }

    // enemy fire pings
    const now = performance.now() / 1000;
    for (const e of enemies) {
      if (e.alive === false) continue;
      const lastShot = e.lastShot ?? -1e9;
      const age = now - lastShot;
      if (age > PING_S) continue;
      const bearing = (Math.atan2(e.x - px, -(e.z - pz)) * 180) / Math.PI;
      const rel = (((bearing - heading) % 360) + 540) % 360 - 180;
      if (Math.abs(rel) > halfSpan) continue;
      const x = W / 2 + rel * pxPerDeg;
      c.fillStyle = `rgba(208, 96, 80, ${(1 - age / PING_S) * 0.95})`;
      c.beginPath();
      c.moveTo(x, H - 3);
      c.lineTo(x - 4, H - 11);
      c.lineTo(x + 4, H - 11);
      c.closePath();
      c.fill();
    }

    // fixed center caret (your heading)
    c.fillStyle = '#ecd39a';
    c.fillRect(W / 2 - 1, 16, 2, H - 20);
  }

  // ---------- full tactical map (M) ----------
  private fullmapCanvas = document.getElementById('fullmap-canvas') as HTMLCanvasElement;

  /**
   * Whole-battlefield view: every contact, structure and landmark at once.
   * Drawn from scratch each frame while open — 2D canvas is cheap at this size.
   */
  drawFullMap(
    px: number,
    pz: number,
    yaw: number,
    soldiers: MapContact[],
    obstacles: MapObstacleRect[],
    half: number,
    dumps: Array<{ x: number; z: number; used: boolean }>,
    camp: { x: number; z: number },
    base: { x: number; z: number }
  ) {
    const c = this.fullmapCanvas;
    if (!c) return;
    const size = Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.82);
    if (c.width !== size) {
      c.width = size;
      c.height = size;
    }
    const m = c.getContext('2d')!;
    m.clearRect(0, 0, size, size);
    const pad = 16;
    const toMap = (wx: number, wz: number): [number, number] => [
      pad + ((wx + half) / (half * 2)) * (size - pad * 2),
      pad + ((wz + half) / (half * 2)) * (size - pad * 2),
    ];

    // grid every 20m
    m.strokeStyle = 'rgba(120, 150, 180, 0.10)';
    m.lineWidth = 1;
    for (let g = -half; g <= half; g += 20) {
      const [gx] = toMap(g, 0);
      const [, gz] = toMap(0, g);
      m.beginPath();
      m.moveTo(gx, pad); m.lineTo(gx, size - pad);
      m.moveTo(pad, gz); m.lineTo(size - pad, gz);
      m.stroke();
    }

    // structures
    m.fillStyle = 'rgba(150, 165, 185, 0.35)';
    for (const o of obstacles) {
      const [x, z] = toMap(o.x, o.z);
      m.fillRect(x - o.hx * (size / (half * 2)), z - o.hz * (size / (half * 2)), o.hx * 2 * (size / (half * 2)), o.hz * 2 * (size / (half * 2)));
    }

    // camp + base flags
    const flag = (p: { x: number; z: number }, color: string, label: string) => {
      const [x, z] = toMap(p.x, p.z);
      m.fillStyle = color;
      m.fillRect(x - 5, z - 5, 10, 10);
      m.font = '11px "Segoe UI", system-ui, sans-serif';
      m.textAlign = 'center';
      m.fillText(label, x, z - 9);
    };
    const zh = getLocale() === 'zh';
    flag(camp, 'rgba(210, 80, 70, 0.9)', zh ? '敌营' : 'CAMP');
    flag(base, 'rgba(90, 190, 120, 0.9)', zh ? '基地' : 'BASE');

    // resupply dumps
    for (const d of dumps) {
      const [x, z] = toMap(d.x, d.z);
      m.save();
      m.translate(x, z);
      m.rotate(Math.PI / 4);
      m.fillStyle = d.used ? 'rgba(110, 130, 140, 0.4)' : 'rgba(90, 200, 220, 0.95)';
      m.fillRect(-4, -4, 8, 8);
      m.restore();
    }

    // soldiers: hostile red (rpg orange), ally green, downed ally blinking yellow
    const now = performance.now();
    for (const e of soldiers) {
      if (e.alive === false) continue;
      const [x, z] = toMap(e.x, e.z);
      let color = 'rgba(225, 90, 75, 0.95)'; // hostile
      if (e.team === 'ally') {
        color = e.downed
          ? `rgba(240, 210, 90, ${0.5 + 0.5 * Math.sin(now / 120)})`
          : 'rgba(105, 200, 120, 0.95)';
      } else if (e.classKey === 'rpg') {
        color = 'rgba(240, 160, 70, 0.95)';
      } else if (e.classKey === 'lmg') {
        color = 'rgba(230, 130, 90, 0.95)';
      }
      m.fillStyle = color;
      m.beginPath();
      m.arc(x, z, e.classKey === 'rpg' ? 4.5 : 3.2, 0, Math.PI * 2);
      m.fill();
    }

    // player arrow (white, pointing along yaw)
    const [pxm, pzm] = toMap(px, pz);
    m.save();
    m.translate(pxm, pzm);
    m.rotate(-yaw);
    m.fillStyle = '#f2f6fa';
    m.beginPath();
    m.moveTo(0, -8);
    m.lineTo(5.5, 6);
    m.lineTo(0, 3);
    m.lineTo(-5.5, 6);
    m.closePath();
    m.fill();
    m.restore();
  }

  // ---------- minimap ----------

  private drawMinimap(
    px: number,
    pz: number,
    yaw: number,
    enemies: MapContact[],
    obstacles: MapObstacleRect[],
    half: number,
    barrels: Array<{ x: number; z: number }>,
    exfil: ExfilBlip | null,
    dumps: Array<{ x: number; z: number; used: boolean }> = []
  ) {
    const S = 180;
    const R = 86;
    const cx = S / 2;
    const cy = S / 2;
    const m = this.mctx;
    m.setTransform(2, 0, 0, 2, 0, 0);
    m.clearRect(0, 0, S, S);

    m.save();
    m.beginPath();
    m.arc(cx, cy, R, 0, Math.PI * 2);
    m.clip();
    m.fillStyle = 'rgba(5, 9, 15, 0.62)';
    m.fillRect(0, 0, S, S);

    const s = R / VIEW_M; // world meters -> px
    m.translate(cx, cy);
    m.rotate(yaw); // facing = up

    // arena border
    m.strokeStyle = 'rgba(148, 178, 210, 0.4)';
    m.lineWidth = 1;
    m.strokeRect((-half - px) * s, (-half - pz) * s, half * 2 * s, half * 2 * s);

    // obstacles
    m.fillStyle = 'rgba(148, 178, 210, 0.3)';
    for (const o of obstacles) {
      if (Math.abs(o.x - px) > VIEW_M + 10 || Math.abs(o.z - pz) > VIEW_M + 10) continue;
      m.fillRect(
        (o.x - px) * s - o.hx * s,
        (o.z - pz) * s - o.hz * s,
        o.hx * 2 * s,
        o.hz * 2 * s
      );
    }

    // fuel drums (amber dots — chain-detonation hazards worth tracking)
    m.fillStyle = 'rgba(224, 152, 66, 0.85)';
    for (const b of barrels) {
      if (Math.abs(b.x - px) > VIEW_M || Math.abs(b.z - pz) > VIEW_M) continue;
      m.beginPath();
      m.arc((b.x - px) * s, (b.z - pz) * s, 2.5, 0, Math.PI * 2);
      m.fill();
    }

    // exfiltration zone: ring when in range, rim chevron when beyond it
    if (exfil) {
      const dxm = (exfil.x - px) * s;
      const dzm = (exfil.z - pz) * s;
      const d = Math.hypot(dxm, dzm) || 1;
      const inRange = d < R - 9;
      const k = inRange ? 1 : (R - 11) / d;
      const ex = dxm * k;
      const ez = dzm * k;
      const col = exfil.active ? 'rgba(143, 214, 106, 0.95)' : 'rgba(118, 148, 118, 0.6)';
      m.strokeStyle = col;
      m.fillStyle = col;
      m.lineWidth = 2;
      if (inRange) {
        m.beginPath();
        m.arc(ex, ez, CONFIG.mission.exfilRadius * s, 0, Math.PI * 2);
        m.stroke();
        m.font = '9px "Segoe UI", system-ui, sans-serif';
        m.textAlign = 'center';
        m.fillText(getLocale() === 'zh' ? '撤' : 'EX', ex, ez + 3);
      } else {
        // off-map: chevron pinned to the rim, pointing at the zone
        const a = Math.atan2(dzm, dxm);
        m.save();
        m.translate(ex, ez);
        m.rotate(a);
        m.beginPath();
        m.moveTo(7, 0);
        m.lineTo(-4, -5.5);
        m.lineTo(-4, 5.5);
        m.closePath();
        m.fill();
        m.restore();
      }
    }

    // enemy blips: bright when recently fired, dim when close, else hidden
    const now = performance.now() / 1000;
    for (const e of enemies) {
      if (e.alive === false) continue;
      const lastShot = e.lastShot ?? -1e9;
      const age = now - lastShot;
      const close = Math.hypot(e.x - px, e.z - pz) < 20;
      if (age > PING_S && !close) continue;
      const dx = (e.x - px) * s;
      const dz = (e.z - pz) * s;
      m.fillStyle = `rgba(208, 96, 80, ${age < PING_S ? 0.6 + 0.4 * (1 - age / PING_S) : 0.55})`;
      m.beginPath();
      m.arc(dx, dz, age < PING_S ? 4 : 3, 0, Math.PI * 2);
      m.fill();
    }

    // resupply dumps: cyan diamonds (dim once used)
    for (const d of dumps) {
      const dx = (d.x - px) * s;
      const dz = (d.z - pz) * s;
      if (Math.hypot(dx, dz) > R + 4) continue;
      m.save();
      m.translate(dx, dz);
      m.rotate(Math.PI / 4);
      m.fillStyle = d.used ? 'rgba(110, 130, 140, 0.35)' : 'rgba(90, 200, 220, 0.9)';
      m.fillRect(-3, -3, 6, 6);
      m.restore();
    }

    // north marker (stays on world north as the map rotates)
    const zh = getLocale() === 'zh';
    m.fillStyle = 'rgba(236, 211, 154, 0.9)';
    m.font = `${zh ? '12' : '11'}px "Segoe UI", system-ui, sans-serif`;
    m.textAlign = 'center';
    m.fillText(zh ? '北' : 'N', 0, -(R - 10));

    m.restore();

    // player arrow (fixed at center, pointing up = facing)
    m.fillStyle = '#d8e4ee';
    m.beginPath();
    m.moveTo(cx, cy - 7);
    m.lineTo(cx - 5, cy + 5);
    m.lineTo(cx, cy + 2);
    m.lineTo(cx + 5, cy + 5);
    m.closePath();
    m.fill();

    // rim
    m.strokeStyle = 'rgba(148, 178, 210, 0.45)';
    m.lineWidth = 1.5;
    m.beginPath();
    m.arc(cx, cy, R + 1, 0, Math.PI * 2);
    m.stroke();
  }
}
