/**
 * Unified sample host — one boot path for all content packages except the
 * full Night Raid Game class (still special-cased in main for its menu flow).
 * Framework V2 U1/U4: daylight, autoplay, present, system registration.
 */
import * as THREE from 'three';
import { applyDaylight, addSunDisc } from '../blocks/scene';
import type { Engine } from '../engine/Engine';
import type { GameCreateContext, GameInstance } from './define';
import type { DefinedGame } from './defineGame';
import type { System } from '../engine/types';

export interface MountSampleOptions {
  engine: Engine;
  /** Live three.js scene + camera from createEngineAsync. */
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun?: THREE.DirectionalLight;
  hemi?: THREE.HemisphereLight;
  parent?: HTMLElement;
  quality?: unknown;
  /** Optional physics/audio/input for GameCreateContext.services. */
  services?: import('./define').GameServices;
}

export interface MountedSample {
  instance: GameInstance;
  dispose: () => void;
}

export function createPresentSystem(
  name: string,
  render: (scene: THREE.Scene, camera: THREE.Camera) => void,
  scene: THREE.Scene,
  camera: THREE.Camera,
): System {
  return {
    name,
    update() {
      render(scene, camera);
    },
  };
}

export function createAutoplaySystem(name = 'sample.playing'): System {
  return {
    name,
    update(_ft, world) {
      world.playing = true;
    },
  };
}

export function mountSampleGame(
  mod: DefinedGame,
  opts: MountSampleOptions & { render: (s: THREE.Scene, c: THREE.Camera) => void },
): MountedSample {
  const { engine, scene, camera } = opts;
  const spec = mod.spec;

  // Daylight default ON for demos; set daylight: false to keep engine night look.
  if (spec.daylight !== false) {
    applyDaylight({ scene, sun: opts.sun, hemi: opts.hemi });
    addSunDisc(scene);
  }

  const ctx: GameCreateContext = {
    scene,
    camera,
    quality: opts.quality,
    parent: opts.parent,
    services: opts.services ?? {
      physics: engine.services.physics ?? undefined,
      audio: engine.services.audio ?? undefined,
      input: engine.services.input ?? undefined,
    },
  };

  const instance = mod.instantiate!(ctx);

  if (spec.autoPlay !== false) {
    engine.addSystem(createAutoplaySystem());
  }
  for (const s of instance.systems) engine.addSystem(s);
  engine.addSystem(createPresentSystem('sample.present', opts.render, scene, camera));

  return {
    instance,
    dispose() {
      instance.dispose?.();
    },
  };
}
