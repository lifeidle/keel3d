// Destructible cover: wooden crates you can shoot apart to open sightlines.
// Each crate is an independent static body with HP; bullets chip it, and at
// zero HP it shatters into a few tumbling debris fragments (dynamic bodies that
// settle and fade out). Sandbags / concrete / ruins stay solid ???only timber goes.
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d';
import { CONFIG } from '../../../config';
import { PhysicsWorld } from '../../../physics/world';
import { Audio } from '../audio/audio';
import { crateTexture } from '../../../world/textures';
import { upgrade } from '../world/phototex';

interface CrateRec {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  pos: THREE.Vector3;
  hp: number;
  alive: boolean;
  flash: number;
  /** Bound to the owning Destructibles manager (shell/bullet hit path). */
  hit: (dmg: number) => boolean;
}

interface FragRec {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
  dieAt: number;
}

export class Destructibles {
  private group = new THREE.Group();
  private crates: CrateRec[] = [];
  private frags: FragRec[] = [];
  private now = 0;

  constructor(
    private scene: THREE.Scene,
    private physics: PhysicsWorld,
    private audio: Audio,
    private rand: () => number
  ) {
    scene.add(this.group);
  }

  /** Place one wooden crate box sitting on the terrain at (x,z), ground y = gy. */
  addBox(x: number, z: number, gy: number, s: number, yOffset: number, color: number) {
    const half = s / 2;
    const cy = gy + yOffset + half;
    // wood plank texture tints toward the per-cluster tone (color) for variety
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0,
      map: crateTexture(),
    });
    mat.color.offsetHSL(0, 0, (this.rand() - 0.5) * 0.05);
    // plywood photo set swaps in async once decoded (all crates share the pair)
    upgrade(mat, 'plywood', 2, 0.8);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
    mesh.position.set(x, cy, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    // fixed body + collider, with userData so the weapon raycast can resolve it
    // (collider.parent().userData is how weapon.ts identifies what was hit)
    const rec: CrateRec = {
      mesh,
      mat,
      body: null as unknown as RAPIER.RigidBody,
      collider: null as unknown as RAPIER.Collider,
      pos: new THREE.Vector3(x, cy, z),
      hp: CONFIG.destructible.hp,
      alive: true,
      flash: 0,
      // late-bound closure: weapons/shells call `ud.rec.hit(dmg)` directly on
      // the record; this forwards into the manager's real damage path.
      hit: (dmg: number) => this.hit(rec, dmg),
    };
    const body = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(x, cy, z)
        .setUserData({ type: 'crate', rec })
    );
    rec.body = body;
    rec.collider = this.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(half, half, half).setFriction(0.8).setRestitution(0),
      body
    );
    this.crates.push(rec);
  }

  /** Bullet damage from the weapon system. Returns true if it just shattered. */
  hit(rec: CrateRec, dmg: number): boolean {
    if (!rec.alive) return false;
    rec.hp -= dmg;
    rec.flash = 1;
    if (rec.hp <= 0) {
      this.shatter(rec);
      return true;
    }
    return false;
  }

  private shatter(rec: CrateRec) {
    rec.alive = false;
    const p = rec.pos;
    const half = (rec.mesh.geometry as THREE.BoxGeometry).parameters.width / 2;

    // remove the solid crate
    this.group.remove(rec.mesh);
    rec.mesh.geometry.dispose();
    rec.mat.dispose();
    try {
      this.physics.world.removeRigidBody(rec.body);
    } catch {
      /* gone */
    }

    this.audio.playWoodCrack();

    // spawn tumbling debris fragments (dynamic, short-lived)
    const count = CONFIG.destructible.fragments;
    for (let i = 0; i < count; i++) {
      const fs = half * (0.3 + this.rand() * 0.3);
      const fmat = new THREE.MeshStandardMaterial({
        color: rec.mat.color.getHex(),
        roughness: 0.9,
        metalness: 0,
      });
      const fmesh = new THREE.Mesh(new THREE.BoxGeometry(fs, fs, fs), fmat);
      fmesh.castShadow = true;
      fmesh.position.set(
        p.x + (this.rand() - 0.5) * half,
        p.y + (this.rand() - 0.5) * half,
        p.z + (this.rand() - 0.5) * half
      );
      this.group.add(fmesh);
      const body = this.physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(fmesh.position.x, fmesh.position.y, fmesh.position.z)
          .setLinearDamping(0.4)
          .setAngularDamping(0.4)
      );
      this.physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(fs / 2, fs / 2, fs / 2).setFriction(0.7).setRestitution(0.2),
        body
      );
      body.applyImpulse(
        {
          x: (this.rand() - 0.5) * 3,
          y: 1.5 + this.rand() * 2.5,
          z: (this.rand() - 0.5) * 3,
        },
        true
      );
      this.frags.push({ body, mesh: fmesh, dieAt: this.now + CONFIG.destructible.fragLife });
    }
  }

  /** Age and retire debris fragments. */
  update(dt: number) {
    this.now += dt;
    for (let i = this.frags.length - 1; i >= 0; i--) {
      const f = this.frags[i];
      if (this.now >= f.dieAt) {
        try {
          this.physics.world.removeRigidBody(f.body);
        } catch {
          /* gone */
        }
        this.group.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        this.frags.splice(i, 1);
      }
    }
    // fade hit-flash on surviving crates
    for (const c of this.crates) {
      if (c.alive && c.flash > 0) {
        c.flash = Math.max(0, c.flash - dt * 3);
        c.mat.emissive.setHex(0x884422);
        c.mat.emissiveIntensity = c.flash * 0.9;
      }
    }
  }

  dispose() {
    for (const c of this.crates) {
      if (c.alive) {
        this.group.remove(c.mesh);
        c.mesh.geometry.dispose();
        c.mat.dispose();
        try {
          this.physics.world.removeRigidBody(c.body);
        } catch {
          /* gone */
        }
      }
    }
    for (const f of this.frags) {
      try {
        this.physics.world.removeRigidBody(f.body);
      } catch {
        /* gone */
      }
      this.group.remove(f.mesh);
      f.mesh.geometry.dispose();
      (f.mesh.material as THREE.Material).dispose();
    }
    this.scene.remove(this.group);
    this.crates = [];
    this.frags = [];
  }
}
