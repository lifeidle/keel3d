// HD photo texture sets (diffuse + normal, 1024²) lifted from the Steel
// Frontline V5 asset pack — AmbientCG-derived CC0 originals shipped inside
// that build. Files live in public/textures/.
//
// Loading is deliberately *asynchronous and additive*: every material keeps
// its procedural canvas texture (see textures.ts) until the photo set
// arrives, then gets upgraded in place. That means no black/missing-texture
// frame on the first map, and Node test runs (no DOM, never render) are
// completely unaffected.
import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';

export type HDName =
  | 'sand_01'
  | 'rough_concrete'
  | 'plywood'
  | 'rusty_metal'
  | 'corrugated_iron'
  | 'rock_04';

/** One loaded set; instances are shared per (name, repeat) key. */
interface Base {
  diffuse: THREE.Texture;
  normal: THREE.Texture;
}

const bases = new Map<HDName, Base>();
const starting = new Set<HDName>();
const shared = new Map<string, Base>(); // `${name}:${repeat}` -> set

interface Waiter {
  mat: THREE.MeshStandardMaterial;
  name: HDName;
  repeat: number;
  normalScale: number;
}
const waiters: Waiter[] = [];

let loader: THREE.TextureLoader | null = null;

function begin(name: HDName) {
  if (starting.has(name)) return;
  starting.add(name);
  const url = (kind: 'diff' | 'nor') => `./textures/${name}_${kind}.webp`;
  let diffuse: THREE.Texture | null = null;
  let normal: THREE.Texture | null = null;
  const finishOne = () => {
    if (!diffuse || !normal) return;
    bases.set(name, { diffuse, normal });
    flush();
  };
  // A failed download must NOT strand the upgrade silently: log once and arm a
  // retry, because every affected material keeps its procedural fallback either
  // way — the only cost of staying down is a flatter-looking prop.
  const fail = (kind: string) => {
    console.warn(`[phototex] ${name}_${kind} failed — procedural texture stays; retrying in 30s`);
    window.setTimeout(() => {
      starting.delete(name);
      begin(name);
    }, 30000);
  };
  loader!.load(
    url('diff'),
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace; // albedo is sRGB
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      diffuse = t;
      finishOne();
    },
    undefined,
    () => fail('diff')
  );
  loader!.load(
    url('nor'),
    (t) => {
      // normal maps stay in linear space (the default NoColorSpace)
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      normal = t;
      finishOne();
    },
    undefined,
    () => fail('nor')
  );
}

/** Cached texture pair for a given tiling density. */
function getShared(name: HDName, repeat: number): Base | null {
  const base = bases.get(name);
  if (!base) return null;
  const key = `${name}:${repeat}`;
  let hit = shared.get(key);
  if (!hit) {
    // clones share the decoded image (THREE source cache) — one GPU upload,
    // independent tiling per consumer.
    const map = base.diffuse.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat, repeat);
    map.needsUpdate = true;
    const normalMap = base.normal.clone();
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(repeat, repeat);
    normalMap.needsUpdate = true;
    hit = { diffuse: map, normal: normalMap };
    shared.set(key, hit);
  }
  return hit;
}

function apply(w: Waiter) {
  const set = getShared(w.name, w.repeat);
  if (!set) return;
  try {
    w.mat.map = set.diffuse;
    w.mat.normalMap = set.normal;
    w.mat.normalScale.setScalar(w.normalScale);
    // adding a normal map changes the shader program — force a recompile
    w.mat.needsUpdate = true;
  } catch {
    /* material disposed with an earlier map — nothing to upgrade */
  }
}

function flush() {
  for (const w of waiters) apply(w);
  waiters.length = 0;
}

/**
 * Upgrade a material to a photo set once it is available. Safe to call on
 * materials that already carry a procedural texture: the swap happens in
 * place when the image decodes, and the material keeps working either way.
 */
export function upgrade(
  mat: THREE.MeshStandardMaterial,
  name: HDName,
  repeat = 1,
  normalScale = 0.85
) {
  if (!HAS_DOM) return;
  if (!loader) loader = new THREE.TextureLoader();
  const hit = getShared(name, repeat);
  if (hit) {
    apply({ mat, name, repeat, normalScale });
    return;
  }
  waiters.push({ mat, name, repeat, normalScale });
  begin(name);
}

/** Kick off downloads at boot so the first map is likely already HD. */
export function prefetchHD() {
  if (!HAS_DOM) return;
  if (!loader) loader = new THREE.TextureLoader();
  // only sets actually consumed by props today — corrugated_iron stays on disk
  // for future tin-shelter props without costing a boot-time download.
  begin('sand_01');
  begin('rough_concrete');
  begin('plywood');
  begin('rusty_metal');
  begin('rock_04');
}
