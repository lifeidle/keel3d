/**
 * Shared GLTF loader with Draco decode support.
 * Optimized models live in public/models-opt/ (Draco); plain models in
 * public/models/ still load if Draco is unavailable.
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

let shared: GLTFLoader | null = null;

/** Draco decoder files copied to public/draco/gltf/ (not CDN). */
const DRACO_PATH = '/draco/gltf/';

export function createGltfLoader(): GLTFLoader {
  if (shared) return shared;
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_PATH);
  loader.setDRACOLoader(draco);
  shared = loader;
  return shared;
}

/** Prefer compressed model when present; fall back to plain path. */
export function modelUrl(name: string): string {
  return `/models-opt/${name}`;
}
