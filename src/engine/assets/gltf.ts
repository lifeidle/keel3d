/**
 * Shared GLTF loader with Draco (+ optional KTX2) decode support.
 * Optimized models live in public/models-opt/ (Draco); plain models in
 * public/models/ still load if Draco is unavailable.
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

let shared: GLTFLoader | null = null;

/** Draco decoder files copied to public/draco/gltf/ (not CDN). */
const DRACO_PATH = '/draco/gltf/';
/** Basis/KTX2 transcoder copied to public/basis/ (not CDN). */
const KTX2_PATH = '/basis/';

export function createGltfLoader(): GLTFLoader {
  if (shared) return shared;
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);
  loader.setDRACOLoader(draco);
  try {
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(KTX2_PATH);
    loader.setKTX2Loader(ktx2);
  } catch {
    // KTX2 optional — Draco-only is fine
  }
  shared = loader;
  return shared;
}

/** Prefer compressed model when present; fall back to plain path. */
export function modelUrl(name: string): string {
  return `/models-opt/${name}`;
}
