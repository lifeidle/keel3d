// Mission objectives: a seeded objective layered on top of "kill everything".
//
// Four kinds, chosen deterministically from the map seed so ?seed= always
// reproduces the same operation:
//   eliminate — clear every hostile (classic)
//   extract   — clear every hostile, THEN reach the exfiltration zone
//   assault   — clear every hostile inside a hard time limit
//   capture   — seize the enemy flag (it flips + the garrison counterattacks),
//               then mop up the survivors
import * as THREE from 'three';
import { CONFIG } from '../../../config';
import type { GeneratedMap } from '../../../world/mapgen';
import { mulberry32 } from '../../../util/rng';

export type MissionKind = 'eliminate' | 'extract' | 'assault' | 'capture';

export interface MissionDef {
  kind: MissionKind;
  timeLimit: number; // seconds; 0 = unlimited
}

const KINDS: MissionKind[] = ['eliminate', 'extract', 'assault', 'capture'];

// Deterministic PRNG (mulberry32) imported from ../util/rng.

/** Deterministic mission roll from the map seed. */
export function pickMission(seed: number): MissionDef {
  const kind = KINDS[Math.abs(seed | 0) % KINDS.length];
  return {
    kind,
    timeLimit: kind === 'assault' ? CONFIG.mission.assaultTime : 0,
  };
}

export type MissionResult = 'none' | 'win' | 'lose';

export interface ObjectiveView {
  titleKey: string; // i18n key for the mission name
  descKey: string; // i18n key for the one-line brief
  progress: string; // e.g. "2 / 4"
  timer: string | null; // "01:52" for timed missions, else null
  urgent: boolean; // timer in its final warning window
}

export class Mission {
  readonly def: MissionDef;
  /** Exfiltration zone centre (only meaningful for 'extract'). */
  readonly exfil = new THREE.Vector3();
  /** Hostile camp centre — the capture flag stands here. */
  private camp: { x: number; z: number } | null;
  /** Fired once when the player seizes the flag ('capture' kind). */
  onCapture: (() => void) | null = null;
  private captured = false;
  private group = new THREE.Group();
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private glowMat: THREE.MeshBasicMaterial; // top beacon glow + ring markers
  private markers: THREE.Mesh[] = [];
  private pulse = 0;
  private cleared = false; // all hostiles down
  private timeLeft: number;

  constructor(
    private scene: THREE.Scene,
    map: GeneratedMap
  ) {
    this.def = pickMission(map.seed);
    this.timeLeft = this.def.timeLimit;
    this.camp = map.camp ?? null;

    // --- pick an exfil spot beyond the PLAYER'S OWN base (friendly lines):
    // after the assault on the camp, extraction reads as falling back through
    // your own half — and it is automatically the farthest side from the camp.
    const rand = mulberry32(map.seed ^ 0x5f3759df);
    const half = CONFIG.map.half;
    const base = map.base;
    const br = Math.hypot(base.x, base.z);
    const axisA = Math.atan2(base.z, base.x);
    let best: THREE.Vector3 | null = null;
    for (let i = 0; i < 240; i++) {
      const a = axisA + (rand() * 2 - 1) * 1.4; // stay on the friendly half
      const r = br + 16 + rand() * (half - br - 22);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const blocked = map.obstacles.some(
        (b) => Math.abs(x - b.x) < b.hx + 4 && Math.abs(z - b.z) < b.hz + 4
      );
      if (blocked) continue;
      best = new THREE.Vector3(x, map.terrain.heightAt(x, z), z);
      break;
    }
    if (!best) {
      // fallback: dead ahead of the base, near the border
      const r = half - 12;
      best = new THREE.Vector3(Math.cos(axisA) * r, 0, Math.sin(axisA) * r);
      best.y = map.terrain.heightAt(best.x, best.z);
    }
    this.exfil.copy(best);

    // --- exfil visuals: ground ring + vertical light column ---
    const R = CONFIG.mission.exfilRadius;
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0x4a5f4a,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.28, R, 40), this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;

    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0x8fd66a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.55, R * 0.55, 26, 16, 1, true),
      this.beamMat
    );

    // additive beacon elements (never a light — keeps the light count fixed)
    this.glowMat = new THREE.MeshBasicMaterial({
      color: 0x9fe87a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), this.glowMat);
    glow.position.y = 25;
    this.group.add(glow);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.glowMat);
      m.position.set(Math.cos(a) * R * 0.82, 0.16, Math.sin(a) * R * 0.82);
      this.markers.push(m);
      this.group.add(m);
    }

    this.group.add(this.ring);
    this.group.add(this.beam);
    this.group.position.copy(this.exfil);
    this.ring.position.y = 0.06;
    this.beam.position.y = 13;

    if (this.def.kind === 'extract') {
      this.group.visible = true;
      scene.add(this.group);
    } else {
      this.group.visible = false;
    }
  }

  /** Distance from a point to the exfil centre, in the XZ plane. */
  private distToExfil(p: THREE.Vector3): number {
    return Math.hypot(p.x - this.exfil.x, p.z - this.exfil.z);
  }

  /**
   * Advance the mission. Returns 'win' the moment the objective completes and
   * 'lose' when a time limit expires.
   */
  update(dt: number, playerPos: THREE.Vector3, aliveEnemies: number, _total: number): MissionResult {
    if (aliveEnemies <= 0) this.cleared = true;

    // capture: standing on the enemy flag flips it — the garrison reacts
    // (see game.onCampCaptured) and the remaining fight becomes a defence
    if (this.def.kind === 'capture' && !this.captured && aliveEnemies > 0) {
      const c = this.camp;
      const d = c ? Math.hypot(playerPos.x - c.x, playerPos.z - c.z) : 1e9;
      if (d < 10) {
        this.captured = true;
        this.onCapture?.();
      }
    }

    if (this.def.timeLimit > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        return 'lose';
      }
    }

    // exfil beacon: dormant until the area is cleared, then it lights up
    if (this.def.kind === 'extract') {
      this.pulse += dt;
      const lit = this.cleared;
      const k = 0.55 + 0.45 * Math.sin(this.pulse * 2.4);
      this.ringMat.color.setHex(lit ? 0x8fd66a : 0x4a5f4a);
      this.ringMat.opacity = lit ? 0.45 + 0.35 * k : 0.32;
      this.beamMat.opacity = lit ? 0.05 + 0.07 * k : 0;
      this.glowMat.opacity = lit ? 0.14 + 0.12 * k : 0;
    }

    if (!this.cleared) return 'none';
    if (this.def.kind === 'extract') {
      return this.distToExfil(playerPos) <= CONFIG.mission.exfilRadius ? 'win' : 'none';
    }
    return 'win';
  }

  /** Snapshot for the HUD objective panel. */
  view(aliveEnemies: number, total: number): ObjectiveView {
    const killed = total - aliveEnemies;
    const stageDone =
      (this.def.kind === 'extract' && this.cleared) ||
      (this.def.kind === 'capture' && this.captured);
    const progress = stageDone ? '★' : `${killed} / ${total}`;
    let timer: string | null = null;
    let urgent = false;
    if (this.def.timeLimit > 0) {
      const s = Math.max(0, Math.ceil(this.timeLeft));
      timer = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      urgent = s <= 30;
    }
    return {
      titleKey: 'mission.' + this.def.kind,
      descKey: 'mission.' + this.def.kind + '.desc',
      progress,
      timer,
      urgent,
    };
  }

  /** Minimap marker, or null when this mission has no exfil zone. */
  exfilBlip(): { x: number; z: number; active: boolean } | null {
    if (this.def.kind !== 'extract') return null;
    return { x: this.exfil.x, z: this.exfil.z, active: this.cleared };
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = (m as unknown as { material?: THREE.Material }).material;
      mat?.dispose?.();
    });
    this.group.clear();
  }
}
