/**
 * Kit — optional procedural placeholder meshes (no external assets).
 */
import * as THREE from 'three';

export function kitCrate(size = 1): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.85 }),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function kitRock(r = 0.8): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(r, 0),
    new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.95 }),
  );
  m.castShadow = true;
  return m;
}

export function kitTree(h = 4): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, h * 0.35, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4030 }),
  );
  trunk.position.y = h * 0.175;
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(h * 0.28, h * 0.7, 7),
    new THREE.MeshStandardMaterial({ color: 0x3f7a38 }),
  );
  crown.position.y = h * 0.55;
  crown.castShadow = true;
  g.add(trunk, crown);
  return g;
}

export function kitHumanoid(color = 0x5b8fd4): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color }),
  );
  body.position.y = 0.9;
  body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd4c4a8 }),
  );
  head.position.y = 1.55;
  g.add(body, head);
  return g;
}

export function kitPillar(h = 3): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, h, 10),
    new THREE.MeshStandardMaterial({ color: 0x9a9a88, roughness: 0.8 }),
  );
  m.position.y = h / 2;
  m.castShadow = true;
  return m;
}

export function kitPad(r = 1.4): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r * 1.05, 0.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x7a8a6a, roughness: 0.9 }),
  );
  m.position.y = 0.1;
  m.receiveShadow = true;
  return m;
}

/** Scatter kit props on XZ. */
export function kitScatter(
  count: number,
  half: number,
  rng: () => number = Math.random,
): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const r = rng();
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    if (Math.hypot(x, z) < 6) continue;
    let obj: THREE.Object3D;
    if (r < 0.35) obj = kitRock(0.5 + rng() * 0.8);
    else if (r < 0.65) obj = kitTree(3 + rng() * 3);
    else if (r < 0.85) obj = kitPillar(2 + rng() * 2);
    else {
      obj = kitCrate(0.8 + rng() * 0.4);
      obj.position.y = 0.5;
    }
    obj.position.x = x;
    obj.position.z = z;
    g.add(obj);
  }
  return g;
}
