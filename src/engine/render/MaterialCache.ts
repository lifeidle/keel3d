/**
 * Shared material cache — one MeshStandardMaterial per key so 50+ soldiers
 * do not each own five materials (shader recompiles + state changes).
 */
import * as THREE from 'three';

export interface StdOpts {
  color: number;
  roughness?: number;
  metalness?: number;
  map?: THREE.Texture | null;
  emissive?: number;
  emissiveIntensity?: number;
  flatShading?: boolean;
}

function stdKey(o: StdOpts): string {
  return [
    o.color,
    o.roughness ?? 1,
    o.metalness ?? 0,
    o.map ? o.map.uuid : '-',
    o.emissive ?? 0,
    o.emissiveIntensity ?? 0,
    o.flatShading ? 1 : 0,
  ].join('|');
}

export class MaterialCache {
  private stdMap = new Map<string, THREE.MeshStandardMaterial>();
  private basicMap = new Map<string, THREE.MeshBasicMaterial>();

  standard(opts: StdOpts): THREE.MeshStandardMaterial {
    const k = stdKey(opts);
    let m = this.stdMap.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: opts.color,
        roughness: opts.roughness ?? 1,
        metalness: opts.metalness ?? 0,
        map: opts.map ?? null,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 0,
        flatShading: opts.flatShading ?? false,
      });
      this.stdMap.set(k, m);
    }
    return m;
  }

  basic(opts: {
    color: number;
    transparent?: boolean;
    opacity?: number;
    blending?: THREE.Blending;
    depthWrite?: boolean;
    map?: THREE.Texture | null;
  }): THREE.MeshBasicMaterial {
    const k = [
      opts.color,
      opts.transparent ? 1 : 0,
      opts.opacity ?? 1,
      opts.blending ?? 0,
      opts.depthWrite !== false ? 1 : 0,
      opts.map ? opts.map.uuid : '-',
    ].join('|');
    let m = this.basicMap.get(k);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        color: opts.color,
        transparent: opts.transparent ?? false,
        opacity: opts.opacity ?? 1,
        blending: opts.blending ?? THREE.NormalBlending,
        depthWrite: opts.depthWrite ?? true,
        map: opts.map ?? null,
      });
      this.basicMap.set(k, m);
    }
    return m;
  }

  dispose(): void {
    for (const m of this.stdMap.values()) m.dispose();
    for (const m of this.basicMap.values()) m.dispose();
    this.stdMap.clear();
    this.basicMap.clear();
  }
}

/** Process-wide cache for the current page session. */
export const materials = new MaterialCache();
