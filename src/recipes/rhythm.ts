/**
 * Rhythm recipe — hit Space on the beat; score by judge window.
 */
import * as THREE from 'three';
import { defineGame, type BaseRecipeOpts } from '../content/defineGame';
import { CameraRig } from '../blocks/CameraRig';
import { BeatClock } from '../blocks/audio/BeatClock';
import { Scoreboard } from '../blocks/gameplay/Scoreboard';
import { HudPanel } from '../blocks/ui/HudPanel';
import { EndOverlay } from '../blocks/ui/EndOverlay';
import { Toast } from '../blocks/ui/Toast';
import { PauseMenu } from '../blocks/ui/PauseMenu';
import { ControlsOverlay } from '../blocks/ui/ControlsOverlay';
import type { System, EngineWorld } from '../engine/types';

export interface RhythmRecipeOpts extends BaseRecipeOpts {
  bpm?: number;
  duration?: number;
}

export function createRhythmGame(
  opts: RhythmRecipeOpts,
  deps: { scene: THREE.Scene; camera: THREE.PerspectiveCamera },
) {
  const { scene, camera } = deps;
  const bpm = opts.bpm ?? 120;
  const duration = opts.duration ?? 30;
  const clock = new BeatClock({ bpm });

  const root = new THREE.Group();
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a2030 }),
  );
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  const padMat = new THREE.MeshStandardMaterial({ color: 0x6ec8ff, emissive: 0x113344 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.3, 24), padMat);
  pad.position.y = 0.15;
  root.add(pad);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.08, 8, 32), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  root.add(ring);

  const score = new Scoreboard();
  const hud = new HudPanel({ id: 'rhythm-hud', position: 'tl' });
  const endOverlay = new EndOverlay();
  const COMBO_GOAL = 20;
  let combo = 0;
  const toast = new Toast();
  const rig = new CameraRig(camera, { defaultMode: 'orbit', blend: 0.2, orbit: { distance: 10, height: 6, pitch: 0.6 } });

  let perfect = 0;
  let good = 0;
  let miss = 0;
  let status: 'playing' | 'over' | 'win' = 'playing';
  let lastBeat = -1;
  let hitThisBeat = false;
  const pause = new PauseMenu({
    title: '节奏',
    active: () => status === 'playing',
  });
  const controls = new ControlsOverlay({
    title: '节奏',
    hints: [
      { keys: ['空格', 'J'], label: '卡拍' },
      { keys: ['Esc'], label: '暂停' },
    ],
    footer: '桌面设备体验更佳',
    duration: 6,
  });

  function onHit() {
    if (status !== 'playing') return;
    const j = clock.judge();
    if (hitThisBeat) {
      miss++;
      toast.show('连点');
      return;
    }
    hitThisBeat = true;
    if (j === 'perfect') {
      perfect++;
      score.addKill();
        combo++;
        if (combo >= COMBO_GOAL && status === 'playing') {
          status = 'win';
          endOverlay.show(`连击 ${COMBO_GOAL}！— 按 R 再来`, true);
        }
      toast.show('PERFECT');
      padMat.emissive.setHex(0x2266aa);
    } else if (j === 'good') {
      good++;
      combo = 0;
        score.add("miss", 1);
      toast.show('GOOD');
      padMat.emissive.setHex(0x224466);
    } else {
      miss++;
      toast.show('MISS');
    }
  }

  function onKey(e: KeyboardEvent) {
    // Hits are scored straight from this handler, so a paused run must not
    // register them (the sim gate alone would still let you farm score).
    if (pause.paused) return;
    if (e.code === 'Space' || e.code === 'KeyJ') onHit();
  }
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);

  const systems: System[] = [
    {
      name: `${opts.id}.sim`,
      update(ft: number, world: EngineWorld) {
        if (world.playing && status === 'playing' && !pause.paused) {
          clock.update(ft);
          score.tick(ft);
          if (clock.beatIndex !== lastBeat) {
            lastBeat = clock.beatIndex;
            hitThisBeat = false;
            padMat.emissive.setHex(0x113344);
          }
          // ring pulse by phase
          const k = 1 + clock.phase * 0.35;
          ring.scale.set(k, k, 1);
          ringMat.opacity = 0.9 - clock.phase * 0.5;
          if (score.time >= duration) {
            status = 'over';
          combo = 0;
            const total = perfect + good + miss;
            const acc = total ? Math.round(((perfect + good * 0.5) / total) * 100) : 0;
            endOverlay.show(`结束 · 完美 ${perfect} · 良 ${good} · 失误 ${miss} · 准 ${acc}%`, acc >= 60);
          }
        }
        rig.update(ft, new THREE.Vector3(0, 0.5, 0), performance.now() / 4000);
        hud.setText(
          `目标连击 ${COMBO_GOAL} · 连击 ${combo} · BPM ${bpm} · 完美 ${perfect} · 良 ${good} · 失误 ${miss}\n空格/J 卡拍 · 剩余 ${Math.max(0, duration - score.time).toFixed(0)}s`,
        );
      },
    },
    pause.system,
    controls.system,
  ];

  return {
    systems,
    dispose() {
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
      scene.remove(root);
      hud.dispose();
      endOverlay.dispose();
      toast.dispose();
      pause.dispose();
      controls.dispose();
    },
    stats: () => ({ perfect, good, miss, status }),
  };
}

export function rhythmRecipe(opts: RhythmRecipeOpts) {
  return defineGame({
    id: opts.id,
    title: opts.title ?? opts.id,
    daylight: false,
    autoPlay: true,
    camera: 'orbit',
    create: (ctx) => createRhythmGame(opts, { scene: ctx.scene, camera: ctx.camera }),
  });
}
