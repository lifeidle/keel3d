/**
 * ChunkWorld — load/unload a ring of chunks around a focus point.
 * Framework standard piece for MapSpec.stream (Sample C and open worlds).
 * Content supplies buildChunk(cx, cz); blocks own the ring policy.
 */
import * as THREE from 'three';

export interface ChunkCoord {
  cx: number;
  cz: number;
}

export interface ChunkWorldOpts {
  /** World units per chunk edge. */
  chunkSize: number;
  /** Load radius in chunks (0 = only the focus chunk). */
  ring?: number;
  buildChunk: (cx: number, cz: number) => THREE.Object3D;
  /** Optional cleanup when a chunk unloads. */
  disposeChunk?: (obj: THREE.Object3D) => void;
}

function key(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export class ChunkWorld {
  private loaded = new Map<string, { coord: ChunkCoord; obj: THREE.Object3D }>();
  private group = new THREE.Group();
  private chunkSize: number;
  private ring: number;
  private buildChunk: ChunkWorldOpts['buildChunk'];
  private disposeChunk?: ChunkWorldOpts['disposeChunk'];
  /** Last focus cell — skip ring rebuild when the player stays in the same chunk. */
  private lastCx = Number.NaN;
  private lastCz = Number.NaN;
  private lastRing = -1;

  constructor(opts: ChunkWorldOpts) {
    this.chunkSize = opts.chunkSize;
    this.ring = opts.ring ?? 1;
    this.buildChunk = opts.buildChunk;
    this.disposeChunk = opts.disposeChunk;
  }

  get object3D(): THREE.Group {
    return this.group;
  }

  get loadedCount(): number {
    return this.loaded.size;
  }

  loadedKeys(): string[] {
    return [...this.loaded.keys()];
  }

  /** Align a world position to chunk indices. */
  worldToChunk(x: number, z: number): ChunkCoord {
    return {
      cx: Math.floor(x / this.chunkSize),
      cz: Math.floor(z / this.chunkSize),
    };
  }

  /**
   * Ensure the ring around `focus` is loaded and anything outside is released.
   * Cheap when already current (no-op if set of keys unchanged).
   */
  update(focusX: number, focusZ: number): void {
    const { cx, cz } = this.worldToChunk(focusX, focusZ);
    if (cx === this.lastCx && cz === this.lastCz && this.ring === this.lastRing) return;
    this.lastCx = cx;
    this.lastCz = cz;
    this.lastRing = this.ring;

    const want = new Set<string>();
    for (let dx = -this.ring; dx <= this.ring; dx++) {
      for (let dz = -this.ring; dz <= this.ring; dz++) {
        want.add(key(cx + dx, cz + dz));
      }
    }

    // unload
    for (const [k, entry] of [...this.loaded]) {
      if (want.has(k)) continue;
      this.group.remove(entry.obj);
      this.disposeChunk?.(entry.obj);
      this.loaded.delete(k);
    }

    // load
    for (const k of want) {
      if (this.loaded.has(k)) continue;
      const [sx, sz] = k.split(',');
      const ccx = Number(sx);
      const ccz = Number(sz);
      const obj = this.buildChunk(ccx, ccz);
      obj.position.set(ccx * this.chunkSize, 0, ccz * this.chunkSize);
      this.group.add(obj);
      this.loaded.set(k, { coord: { cx: ccx, cz: ccz }, obj });
    }
  }

  dispose(): void {
    for (const entry of this.loaded.values()) {
      this.group.remove(entry.obj);
      this.disposeChunk?.(entry.obj);
    }
    this.loaded.clear();
  }
}
