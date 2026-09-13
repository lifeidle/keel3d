/**
 * Daylight look for sample demos (tower / cultivation / flight / race).
 * Mutates the shared engine scene lights + fog so demos read clearly.
 * Sample A (nightraid) keeps its night identity — do not call this there.
 */
import * as THREE from 'three';

export interface DaylightDeps {
  scene: THREE.Scene;
  /** Engine "moon" light doubles as sun. */
  sun?: THREE.DirectionalLight;
  hemi?: THREE.HemisphereLight;
  /** Sky hex, default clear blue. */
  sky?: number;
  fogNear?: number;
  fogFar?: number;
  fogColor?: number;
}

export function applyDaylight(deps: DaylightDeps): void {
  const sky = deps.sky ?? 0x87b5d9;
  deps.scene.background = new THREE.Color(sky);
  deps.scene.fog = new THREE.Fog(deps.fogColor ?? 0xb8c9d4, deps.fogNear ?? 60, deps.fogFar ?? 280);

  if (deps.hemi) {
    deps.hemi.color.setHex(0xcfe8ff);
    deps.hemi.groundColor.setHex(0x5a6a48);
    deps.hemi.intensity = 0.95;
  }
  if (deps.sun) {
    deps.sun.color.setHex(0xfff2d6);
    deps.sun.intensity = 1.35;
    deps.sun.position.set(40, 70, 25);
    deps.sun.castShadow = true;
  }
}

/** Simple sun disc for sky dressing (optional visual cue). */
export function addSunDisc(scene: THREE.Scene, radius = 8): THREE.Mesh {
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }),
  );
  sun.position.set(120, 90, -80);
  sun.name = 'demo-sun-disc';
  scene.add(sun);
  return sun;
}
