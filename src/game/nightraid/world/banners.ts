// Camp banners with a soft cloth-wave animation (atmosphere batch).
//
// Two flags — hostile red at their camp, friendly green at the player's —
// hang from simple poles. The cloth is a subdivided plane whose vertices
// ripple in place every frame; recoloring keeps the "capture" flip working
// through the same materials mapgen used to expose (flagMats).
import * as THREE from 'three';
import { CONFIG } from '../../../config';
import { Terrain } from '../../../world/terrain';

interface Cloth {
  geo: THREE.BufferGeometry;
  pos: THREE.BufferAttribute;
  anchorX: number; // world x of the pole
  speed: number;
  phase: number;
}

export class CampBanners {
  readonly group = new THREE.Group();
  mats: { hostile: THREE.MeshStandardMaterial; friendly: THREE.MeshStandardMaterial };
  private cloths: Cloth[] = [];
  private t = Math.random() * 10;

  constructor(terrain: Terrain, hostile: { x: number; z: number }, friendly: { x: number; z: number }) {
    this.mats = {
      hostile: this.addFlag(terrain, hostile.x, hostile.z, 0x8f2f2f, 1.0),
      friendly: this.addFlag(terrain, friendly.x, friendly.z, 0x3f7a3a, 0.7),
    };
  }

  /** One pole + waving cloth; returns the cloth material (capture recolor). */
  private addFlag(terrain: Terrain, x: number, z: number, color: number, speed: number): THREE.MeshStandardMaterial {
    const gy = terrain.heightAt(x, z);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, CONFIG.map.flagH, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a4a42, roughness: 0.8, metalness: 0.3 })
    );
    pole.position.set(x, gy + CONFIG.map.flagH / 2, z);
    pole.castShadow = true;
    this.group.add(pole);

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
    // subdivided plane: 6 segments across the width, 2 down — enough to wave
    const geo = new THREE.PlaneGeometry(1.5, 0.9, 6, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const cloth = new THREE.Mesh(geo, mat);
    cloth.position.set(x + 0.78, gy + CONFIG.map.flagH - 0.5, z);
    cloth.castShadow = false;
    this.group.add(cloth);
    this.cloths.push({ geo, pos, anchorX: x, speed, phase: Math.random() * Math.PI * 2 });
    return mat;
  }

  /** Ripple the cloths in place — call once per frame from the game loop. */
  update(dt: number) {
    this.t += dt;
    for (const c of this.cloths) {
      const p = c.pos.array as Float32Array;
      const cols = 7; // 6 segments + 1
      const rows = 3;
      for (let iz = 0; iz < rows; iz++) {
        for (let ix = 0; ix < cols; ix++) {
          const i = (iz * cols + ix) * 3;
          // local x runs -0.75..0.75 (plane geometry local space)
          const lx = p[i];
          const along = (lx + 0.75) / 1.5; // 0 at the pole -> 1 at the fly end
          // gentle vertical wave, growing toward the free edge
          p[i + 1] = Math.sin(lx * 3.2 + this.t * (4.2 + c.speed * 3)) * 0.05 * (0.25 + 0.75 * along * along);
          // a little depth ripple so it reads as cloth, not a banner plane
          p[i + 2] = Math.sin(lx * 5.1 + this.t * c.speed * 6 + c.phase) * 0.03 * along;
        }
      }
      c.pos.needsUpdate = true;
    }
  }
}
