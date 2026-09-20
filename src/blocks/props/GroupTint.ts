/**
 * GroupTint — dim/tint a placed prop group (R87).
 *
 * Gap: content whose props change STATE (consumed loot crates, destroyed
 * structures) needs to darken the prop and later revert it. `dimGroup`
 * collects the group's UNIQUE materials (a material shared by several
 * meshes is dimmed exactly once), scales colour (and emissive, when the
 * material has one) by `factor`, and hands back `restore()`.
 */
import * as THREE from 'three';

export interface TintHandle {
  /** Meshes visited (informational). */
  meshes: THREE.Mesh[];
  /** Restore the original material colours/emissive. */
  restore(): void;
}

/**
 * Darken every mesh in `group` by `factor` (0 < factor <= 1 typical).
 * Shared materials are handled once (no double-dimming). Call the returned
 * `restore()` to revert — safe to call once; a second dim without restore
 * compounds on the already-dimmed colour.
 */
export function dimGroup(group: THREE.Group, factor = 0.45): TintHandle {
  if (!(factor > 0) || !Number.isFinite(factor)) {
    throw new Error('dimGroup: factor must be finite and > 0');
  }
  type Tintable = THREE.MeshBasicMaterial & { emissive?: THREE.Color };
  const seen = new Map<Tintable, { color: number; emissive: number }>();
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes.push(o);
    const m = o.material as Tintable;
    if (!seen.has(m)) {
      seen.set(m, {
        color: m.color.getHex(),
        emissive: m.emissive ? m.emissive.getHex() : 0,
      });
    }
  });
  const emissiveMul = Math.min(1, factor * 1.2);
  for (const [m] of seen) {
    m.color.multiplyScalar(factor);
    if (m.emissive) m.emissive.multiplyScalar(emissiveMul);
  }
  return {
    meshes,
    restore() {
      for (const [m, orig] of seen) {
        m.color.setHex(orig.color);
        if (m.emissive) m.emissive.setHex(orig.emissive);
      }
    },
  };
}
