// Spent brass casings ejected from the player's weapon on every shot.
// Real dynamic bodies (tiny cylinder + collider) so they tumble, bounce off the
// terrain and roll realistically, then fade and despawn ~1.5s later. The brass
// geometry + material are created once and shared by every casing.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { PhysicsWorld } from '../../physics/world';

interface Casing {
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  life: number;
}

const LIFE = 1.5;
const FADE = 0.4;

export class ShellCasings {
  private group = new THREE.Group();
  private geo: THREE.CylinderGeometry;
  private mat: THREE.MeshStandardMaterial;
  private list: Casing[] = [];

  constructor(
    private physics: PhysicsWorld,
    private scene: THREE.Scene
  ) {
    this.geo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.045, 6);
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xc9a04a, // polished brass reads well in moonlight
      roughness: 0.35,
      metalness: 0.85,
    });
    scene.add(this.group);
  }

  /** Eject one casing from `pos`, pushed along `right` (with world-up lift). */
  spawn(pos: THREE.Vector3, right: THREE.Vector3, fwd: THREE.Vector3) {
    // per-casing clone so the fade-out doesn't dim every other live casing
    const mat = this.mat.clone();
    mat.transparent = true;
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.castShadow = true;
    this.group.add(mesh);

    const body = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setLinearDamping(0.1)
        .setAngularDamping(0.35)
    );
    // tiny cylinder collider approximates the casing
    this.physics.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.022, 0.0055).setFriction(0.5).setRestitution(0.2),
      body
    );
    // sideways + up + slightly backward, like a real ejection port toss
    const imp = new THREE.Vector3()
      .addScaledVector(right, 1.4 + Math.random() * 0.8)
      .addScaledVector(fwd, -(0.25 + Math.random() * 0.4))
      .add(new THREE.Vector3(0, 1.0 + Math.random() * 0.6, 0));
    body.applyImpulse(imp, true);
    body.setAngvel(
      {
        x: (Math.random() - 0.5) * 40,
        y: (Math.random() - 0.5) * 40,
        z: (Math.random() - 0.5) * 40,
      },
      true
    );
    this.list.push({ mesh, body, life: LIFE });
  }

  /** Age casings, sync visuals to the physics bodies, retire the dead. */
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.life -= dt;
      const tr = c.body.translation();
      const rot = c.body.rotation();
      c.mesh.position.set(tr.x, tr.y, tr.z);
      c.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      if (c.life <= 0) {
        try {
          this.physics.world.removeRigidBody(c.body);
        } catch {
          /* already gone */
        }
        this.group.remove(c.mesh);
        (c.mesh.material as THREE.Material).dispose();
        this.list.splice(i, 1);
        continue;
      }
      // brief fade-out at the end of the casing's life
      if (c.life < FADE) {
        const k = c.life / FADE;
        c.mesh.scale.setScalar(0.2 + k * 0.8);
        (c.mesh.material as THREE.MeshStandardMaterial).opacity = k;
      }
    }
  }
}
