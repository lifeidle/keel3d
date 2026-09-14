// Transient visual effects: tracers, muzzle flashes, impact sparks, explosions.
// Hot path is pooled: shared geometries, per-slot materials (so opacity fades
// stay independent), recycle instead of new/dispose.
//
// Block-layer: no game/ or config imports. Tracer/muzzle colours are injected
// via opts with defaults matching the sample CONFIG palette.
import * as THREE from 'three';
import { bulletHoleTexture } from '../../world/textures';

export interface CombatVfxOpts {
  /** Tracer line colour. Default 0xfff2a8 (matches CONFIG.colors.tracer). */
  tracerColor?: number;
  /** Muzzle-flash colour. Default 0xffd27f (matches CONFIG.colors.muzzle). */
  muzzleColor?: number;
}

const DEFAULT_TRACER = 0xfff2a8;
const DEFAULT_MUZZLE = 0xffd27f;

interface Effect {
  obj: THREE.Object3D;
  life: number;
  maxLife: number;
  kind: 'tracer' | 'flash' | 'spark' | 'boom' | 'smoke' | 'dust';
  vel?: THREE.Vector3;
  grow?: number;
  baseOpacity: number;
}

const TRACER_GEO = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -1),
]);
const FLASH_GEO = new THREE.SphereGeometry(0.12, 6, 6);
const SPARK_GEO = new THREE.SphereGeometry(0.035, 4, 4);
const DEBRIS_GEO = new THREE.SphereGeometry(0.045, 4, 4);
const DUST_GEO = new THREE.SphereGeometry(0.06, 5, 4);
const BOOM_GEO = new THREE.SphereGeometry(0.6, 12, 10);
const SMOKE_GEO = new THREE.SphereGeometry(0.55, 8, 6);

function sparkMat(color: number) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
}
function dustMat(color: number) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
}
function boomMat() {
  return new THREE.MeshBasicMaterial({ color: 0xffa24a, transparent: true, opacity: 1 });
}
function smokeMat() {
  return new THREE.MeshBasicMaterial({
    color: 0x3a3a3c,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
}

export class CombatVfx {
  group = new THREE.Group();
  private list: Effect[] = [];
  private decals: THREE.Mesh[] = [];
  private decalTex: THREE.Texture | null = null;
  private flashLight: THREE.PointLight;
  private boomLights: { light: THREE.PointLight; life: number; maxLife: number; peak: number }[] = [];

  private tracerPool: THREE.Line[] = [];
  private flashPool: THREE.Mesh[] = [];
  private sparkPool: THREE.Mesh[] = [];
  private smokePool: THREE.Mesh[] = [];
  private dustPool: THREE.Mesh[] = [];
  private boomPool: THREE.Mesh[] = [];

  private tracerColor: number;
  private muzzleColor: number;

  constructor(opts: CombatVfxOpts = {}) {
    this.tracerColor = opts.tracerColor ?? DEFAULT_TRACER;
    this.muzzleColor = opts.muzzleColor ?? DEFAULT_MUZZLE;
    this.flashLight = new THREE.PointLight(this.muzzleColor, 0, 12, 2);
    this.group.add(this.flashLight);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 24, 2);
      this.group.add(l);
      this.boomLights.push({ light: l, life: 0, maxLife: 0.5, peak: 60 });
    }
  }

  count() {
    return this.list.length;
  }

  private acquireBoom() {
    let free = this.boomLights.find((b) => b.life <= 0);
    if (!free) free = this.boomLights.reduce((a, b) => (b.life < a.life ? b : a));
    return free;
  }

  private tracerMat() {
    return new THREE.LineBasicMaterial({
      color: this.tracerColor,
      transparent: true,
      opacity: 1,
    });
  }

  private flashMat() {
    return new THREE.MeshBasicMaterial({
      color: this.muzzleColor,
      transparent: true,
      opacity: 0.9,
    });
  }

  private takeTracer(): THREE.Line {
    const l = this.tracerPool.pop();
    if (l) return l;
    const line = new THREE.Line(TRACER_GEO, this.tracerMat());
    line.frustumCulled = false;
    return line;
  }

  private takeFlash(): THREE.Mesh {
    const m = this.flashPool.pop();
    if (m) return m;
    return new THREE.Mesh(FLASH_GEO, this.flashMat());
  }

  /** Sparks share two colour slots; material is owned by the mesh. */
  private takeSpark(color: number, debris = false): THREE.Mesh {
    const m = this.sparkPool.pop();
    if (m) {
      m.geometry = debris ? DEBRIS_GEO : SPARK_GEO;
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      (m.material as THREE.MeshBasicMaterial).opacity = 1;
      return m;
    }
    return new THREE.Mesh(debris ? DEBRIS_GEO : SPARK_GEO, sparkMat(color));
  }

  private takeSmoke(): THREE.Mesh {
    const m = this.smokePool.pop();
    if (m) return m;
    return new THREE.Mesh(SMOKE_GEO, smokeMat());
  }

  private takeDust(color: number): THREE.Mesh {
    const m = this.dustPool.pop();
    if (m) {
      (m.material as THREE.MeshBasicMaterial).color.setHex(color);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.5;
      return m;
    }
    return new THREE.Mesh(DUST_GEO, dustMat(color));
  }

  private takeBoom(): THREE.Mesh {
    const m = this.boomPool.pop();
    if (m) return m;
    return new THREE.Mesh(BOOM_GEO, boomMat());
  }

  private release(e: Effect) {
    const obj = e.obj;
    obj.visible = true;
    obj.scale.setScalar(1);
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    const mat = (obj as THREE.Mesh).material as THREE.Material & { opacity?: number } | undefined;
    if (mat && mat.transparent && mat.opacity !== undefined) mat.opacity = e.baseOpacity;
    this.group.remove(obj);
    if (obj instanceof THREE.Line) this.tracerPool.push(obj);
    else if (e.kind === 'flash') this.flashPool.push(obj as THREE.Mesh);
    else if (e.kind === 'smoke') this.smokePool.push(obj as THREE.Mesh);
    else if (e.kind === 'dust') this.dustPool.push(obj as THREE.Mesh);
    else if (e.kind === 'boom') this.boomPool.push(obj as THREE.Mesh);
    else this.sparkPool.push(obj as THREE.Mesh);
  }

  private aimTracer(line: THREE.Line, from: THREE.Vector3, to: THREE.Vector3) {
    line.position.copy(from);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz) || 0.001;
    line.scale.set(1, 1, len);
    line.lookAt(from.x + dx, from.y + dy, from.z + dz);
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3) {
    const line = this.takeTracer();
    this.aimTracer(line, from, to);
    const mat = line.material as THREE.LineBasicMaterial;
    mat.opacity = 1;
    this.group.add(line);
    this.list.push({ obj: line, life: 0.08, maxLife: 0.08, kind: 'tracer', baseOpacity: 1 });
  }

  muzzle(pos: THREE.Vector3) {
    this.flashLight.position.copy(pos);
    this.flashLight.intensity = 6;
    const m = this.takeFlash();
    m.position.copy(pos);
    m.scale.setScalar(1);
    this.group.add(m);
    this.list.push({ obj: m, life: 0.06, maxLife: 0.06, kind: 'flash', baseOpacity: 0.9 });
  }

  spark(pos: THREE.Vector3, normal?: THREE.Vector3) {
    const nx = normal?.x ?? 0;
    const ny = normal?.y ?? 1;
    const nz = normal?.z ?? 0;
    for (let i = 0; i < 6; i++) {
      const p = this.takeSpark(0xffd27f);
      p.position.copy(pos);
      p.scale.setScalar(1);
      this.group.add(p);
      const jx = nx + (Math.random() - 0.5) * 0.8;
      const jy = ny + Math.random() * 0.6;
      const jz = nz + (Math.random() - 0.5) * 0.8;
      const inv = 1 / (Math.hypot(jx, jy, jz) || 1);
      const sp = 3 + Math.random() * 3;
      this.list.push({
        obj: p,
        life: 0.25,
        maxLife: 0.25,
        kind: 'spark',
        vel: new THREE.Vector3(jx * inv * sp, jy * inv * sp, jz * inv * sp),
        baseOpacity: 1,
      });
    }
  }

  explosion(pos: THREE.Vector3) {
    const fire = this.takeBoom();
    fire.position.copy(pos);
    fire.scale.setScalar(1);
    this.group.add(fire);
    this.list.push({ obj: fire, life: 0.45, maxLife: 0.45, kind: 'boom', grow: 9, baseOpacity: 1 });

    const boom = this.acquireBoom();
    if (boom) {
      boom.light.position.set(pos.x, pos.y + 0.5, pos.z);
      boom.peak = 60;
      boom.maxLife = 0.5;
      boom.life = 0.5;
      boom.light.intensity = 60;
    }

    for (let i = 0; i < 5; i++) {
      const s = this.takeSmoke();
      s.position.copy(pos);
      s.position.y += 0.3;
      s.scale.setScalar(0.9 + Math.random() * 0.35);
      this.group.add(s);
      this.list.push({
        obj: s,
        life: 1.7,
        maxLife: 1.7,
        kind: 'smoke',
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.4,
          1.6 + Math.random() * 1.4,
          (Math.random() - 0.5) * 1.4
        ),
        grow: 0.55,
        baseOpacity: 0.4,
      });
    }

    for (let i = 0; i < 18; i++) {
      const debris = Math.random() < 0.5;
      const p = this.takeSpark(debris ? 0xffb060 : 0x555049, debris);
      p.position.copy(pos);
      p.scale.setScalar(1);
      this.group.add(p);
      let dx = Math.random() - 0.5;
      let dy = Math.random() * 0.8;
      let dz = Math.random() - 0.5;
      const inv = 1 / (Math.hypot(dx, dy, dz) || 1);
      dx *= inv;
      dy *= inv;
      dz *= inv;
      const sp = 5 + Math.random() * 7;
      this.list.push({
        obj: p,
        life: 0.5 + Math.random() * 0.35,
        maxLife: 0.85,
        kind: 'spark',
        vel: new THREE.Vector3(dx * sp, dy * sp, dz * sp),
        baseOpacity: 1,
      });
    }
  }

  dust(pos: THREE.Vector3) {
    for (let i = 0; i < 2; i++) {
      const p = this.takeDust(Math.random() < 0.5 ? 0x9a8a72 : 0x83745e);
      p.position.copy(pos);
      p.position.x += (Math.random() - 0.5) * 0.22;
      p.position.z += (Math.random() - 0.5) * 0.22;
      p.scale.setScalar(0.8 + Math.random() * 0.5);
      this.group.add(p);
      this.list.push({
        obj: p,
        life: 0.6 + Math.random() * 0.2,
        maxLife: 0.8,
        kind: 'dust',
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          0.9 + Math.random() * 1.1,
          (Math.random() - 0.5) * 0.8
        ),
        grow: 0.55,
        baseOpacity: 0.5,
      });
    }
  }

  decal(pos: THREE.Vector3, normal: THREE.Vector3) {
    if (this.decals.length > 90) {
      const old = this.decals.shift()!;
      this.group.remove(old);
      old.geometry.dispose();
      (old.material as THREE.Material).dispose();
    }
    for (const d of this.decals) {
      if (d.position.distanceToSquared(pos) < 0.09) return;
    }
    if (!this.decalTex) this.decalTex = bulletHoleTexture();
    const s = 0.09 + Math.random() * 0.07;
    const mat = new THREE.MeshBasicMaterial({
      map: this.decalTex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat);
    m.position.copy(pos).addScaledVector(normal, 0.015);
    m.rotation.z = Math.random() * Math.PI;
    m.lookAt(pos.x + normal.x * 3, pos.y + normal.y * 3, pos.z + normal.z * 3);
    this.group.add(m);
    this.decals.push(m);
  }

  clearDecals() {
    for (const m of this.decals) {
      this.group.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.decals = [];
  }

  update(dt: number) {
    if (this.flashLight.intensity > 0) {
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 80);
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.life -= dt;
      const t = Math.max(0, e.life / e.maxLife);
      if (e.kind === 'spark' && e.vel) {
        e.obj.position.addScaledVector(e.vel, dt);
        e.vel.y -= 9 * dt;
      } else if (e.kind === 'smoke' && e.vel) {
        e.obj.position.addScaledVector(e.vel, dt);
        e.vel.y += 0.9 * dt;
        e.obj.scale.addScalar((e.grow ?? 0.5) * dt);
      } else if (e.kind === 'dust' && e.vel) {
        e.obj.position.addScaledVector(e.vel, dt);
        e.vel.y += 2.2 * dt;
        e.obj.scale.addScalar((e.grow ?? 0.5) * dt);
      } else if (e.kind === 'boom') {
        e.obj.scale.addScalar((e.grow ?? 8) * dt);
      }
      const mat = (e.obj as THREE.Mesh).material as
        | (THREE.Material & { opacity?: number })
        | undefined;
      if (mat && mat.transparent && mat.opacity !== undefined) {
        mat.opacity = t * e.baseOpacity;
      }
      if (e.life <= 0) {
        this.release(e);
        this.list.splice(i, 1);
      }
    }

    for (const b of this.boomLights) {
      if (b.life > 0) {
        b.life -= dt;
        b.light.intensity = b.peak * Math.max(0, b.life / b.maxLife);
        if (b.life <= 0) b.light.intensity = 0;
      }
    }
  }
}
