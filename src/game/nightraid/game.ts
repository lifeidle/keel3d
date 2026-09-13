// Game orchestrator: owns engine, physics, entities, loop, and the screen
// state machine (boot -> menu -> playing <-> paused -> over).
import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { WeaponDef } from '../../config';
import { WebGpuRequiredError, buildWorld, Engine } from '../../engine/renderer';
import { Input } from '../../engine/input';
import { PhysicsWorld } from '../../physics/world';
import { Player } from './player/player';
import { EnemyManager } from './ai/enemy';
import { Weapon } from './weapons/weapon';
import { Effects } from './effects';
import { Audio } from './audio/audio';
import { MusicDirector } from './audio/music';
import type { Mood } from './audio/music';
import { HUD } from './ui/hud';
import { TacticalUI } from './ui/mapui';
import { generateMap, clearMap, GeneratedMap, seedFromURL } from '../../world/mapgen';
import { buildGunModel } from './world/gunmodels';
import { BarrelManager } from './world/barrels';
import { CasingManager } from './world/casings';
import { Mission } from './world/mission';
import { Weather, moonForSeed } from './world/weather';
import { TouchControls, isTouchDevice } from '../../ui/touch';
import { Netplay } from '../../net/netplay';
import { RemotePlayer, GhostSwarm } from '../../net/ghosts';
import { SnapshotEnemy, SnapshotAlly, encodeSnapshot, decodeInput, NET_EVENTS, BTN, encodeEvent } from '../../net/protocol';
import { Jeep } from './world/jeep';
import { applyDayNight, loadTimeMode, saveTimeMode, type TimeMode } from './world/daynight';
import { Tank } from './world/tank';
import { opScale, loadScale, setScale, SCALES, type OpScale, type ScaleKey } from '../../world/scale';
import { QUALITY, detectQuality, type Quality } from '../../world/quality';
import { QualityController } from '../../engine/quality/QualityController';
import { t, onLocaleChange, getLocale, setLocale, type Locale } from '../../i18n';

const DT = CONFIG.world.fixedDt;

// Max physics substeps per render frame. Capping both the frame delta and the
// accumulator backlog is what prevents the classic "spiral of death": if the
// sim ever falls behind, we drop the excess time instead of hoarding it into
// ever-heavier frames (which is what made the game seize up after a few minutes).
const MAX_FRAME = 0.1; // clamp a single huge gap (tab-out / GC stall / hitch)
const MAX_SUBSTEPS = 5;

type State = 'menu' | 'playing' | 'paused' | 'over' | 'intro';
type ScreenId = 'menu' | 'settings' | 'help' | 'net' | 'pause' | 'end';

export interface GameHostOptions {
  /** Share the framework QualityController (single dynamic-resolution source). */
  qualityCtrl?: QualityController;
  /** When true, mount() does not start rAF — Engine host drives systems. */
  externalLoop?: boolean;
  /** Prebuilt three.js engine (WebGPU or WebGL). Default: sync WebGL. */
  engine?: Engine;
}

export class Game {
  private engine: Engine;
  private physics: PhysicsWorld;
  private input: Input;
  private audio = new Audio();
  private effects = new Effects();
  private player: Player;
  private enemies: EnemyManager;
  private weapon: Weapon;
  private hud = new HUD();
  /** Systems read these during Phase A extraction; A12 tightens visibility. */
  get hudView() { return this.hud; }
  private music = new MusicDirector(this.audio);
  private tactical = new TacticalUI();
  private barrels: BarrelManager;
  private map: GeneratedMap;
  private mission: Mission;
  private weather: Weather;
  private quality: Quality = detectQuality();
  get qualityTier(): Quality { return this.quality; }
  get fpsNow(): number { return this.fps; }
  private qualityCtrl: QualityController;
  private lastRenderScale = 1;
  private externalLoop = false;
  private hostPlaying = false;

  // first-person viewmodels (one cached model per slot, toggled on switch)
  private gunModels = new Map<string, THREE.Group>();
  private activeGun: THREE.Group | null = null;
  private casings: CasingManager;
  private gunKick = 0; // viewmodel recoil impulse (decays each render frame)
  private bobPhase = 0; // walk-cycle phase driving the viewmodel bob

  private state: State = 'menu';
  private victory = false;
  private timedOut = false;
  private shake = 0; // camera shake trauma (decays each frame)
  private lastAlive: number = opScale().enemies;
  private lastSquadAlive: number = opScale().allies;
  // C-batch battlefield dynamics: bounded reinforcement pool + despair charge
  private reinLeft = 0;
  private reinTimer = CONFIG.reinforce.every;
  private charged = false;
  private kills = 0;
  private matchTime = 0;
  private heat = 0; // combat intensity 0..1 (drives the adaptive soundtrack)
  private mood: Mood = 'calm';
  private acc = 0;
  private last = performance.now();
  private menuYaw = 0; // cinematic camera orbit angle (menu backdrop)
  // muzzle-light pool: pre-allocated warm flashes (never per-shot allocations)
  private muzzleLights: THREE.PointLight[] = [];
  private muzzleLi = 0;
  // signal flares (G): pooled lights + discs, slow parachute descent
  private flareLights: THREE.PointLight[] = [];
  private flareDiscs: THREE.Mesh[] = [];
  private flares: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; stage: number; light: number }> = [];
  private flareCd = 0;
  private nightClouds: THREE.Mesh | null = null; // drifting night cloud wisps
  // --- mobile: on-screen controls + touch-mode flag (no pointer lock) ---
  private touch: TouchControls | null = null;
  private onTouch = false;
  // battlefield soundscape state
  private windOn = false;
  private ambT = 5;
  private birdT = 4;
  // diagnostics overlay (toggle with backquote `) — surfaces perf + counts so a
  // real freeze can be reported with hard numbers instead of guesswork.
  private diagEl: HTMLElement | null = null;
  private errEl: HTMLElement | null = null;
  private showDiag = false;
  private fps = 60;
  private slowStreak = 0;
  // adaptive quality: timer state lives on QualityAutoSystem (A2)
  // (lowFpsTime / autoDowngraded removed from Game)
  // voice one-shots: enter line per match, tango cooldown, losing-squad flag
  private enterVoiced = false;
  private tangoCd = 0;
  private losingVoiced = false;
  private holdVoiced = false;
  private allyVoiceCd = 0;
  // night searchlight exposure: periodic cone test with a long cooldown
  private slCheckCd = 0;
  private slWarnCd = 0;
  private streakPlayed = 0; // highest streak milestone voiced this match
  private rattleCd = 0; // off-road rattle throttle while driving
  private resupplied = new Set<number>(); // used ammo dump indices
  private dumpHintOn = false;
  private fullmapOpen = false;
  /** Co-op orchestrator (stage 1 — 2 players, host authoritative). */
  netMode: 'off' | 'host' | 'client' = 'off';
  private remotePlayer: RemotePlayer | null = null;
  private ghostSwarm: GhostSwarm | null = null;
  private netSnapT = 0;
  private netInputT = 0;
  private snapTick = 0;
  private netPvp = false;
  /** ?debug=1 self-test instrumentation flag (cached — no per-frame URL parsing) */
  private dbg = new URLSearchParams(location.search).has('debug');
  private pvpScoreSelf = 0;
  private pvpScoreFoe = 0;
  private pvpTimeLeft = 600; // 10-minute hunt
  private pvpRespawnT = 0;
  /** Created in bindEvents with the live hooks (room UI + ghosts + claims). */
  net!: Netplay;
  private menuCenter = new THREE.Vector3();
  private settingsFrom: Exclude<ScreenId, 'settings'> = 'menu';

  // cinematic fly-in (menu orbit -> first person) — see startMatch/updateIntro
  private introT = 0;
  private introDur = 1.1;
  private introFrom = new THREE.Vector3();
  /** day/night choice from the main menu (persisted to localStorage) */
  private timeMode: TimeMode = 'night';
  /** player-driveable tank (spawns mid-map) */
  private playerTank: Tank | null = null;
  /** enemy AI tank that hunts the player (outer band) */
  private enemyTank: Tank | null = null;
  /** tank currently driven by the player (driving = FPS gunner/chase cam) */
  private driving: Tank | Jeep | null = null;
  /** driveable scout jeep parked near the player's base (new each operation) */
  private jeep: Jeep | null = null;
  /** C toggles the tank camera: gunner seat (1st) or chase (3rd) */
  private tankCamThird = true;
  private tankHintCd = 0; // throttle "press F to board" hint

  constructor(parent: HTMLElement, opts: GameHostOptions = {}) {
    this.externalLoop = !!opts.externalLoop;
    this.qualityCtrl = opts.qualityCtrl ?? new QualityController(this.quality);
    // WebGPU-only: the engine must be prebuilt async (createEngineAsync).
    if (!opts.engine) throw new WebGpuRequiredError('pass a prebuilt engine from createEngineAsync');
    this.engine = opts.engine;
    this.physics = new PhysicsWorld();
    const sky = buildWorld(this.engine.scene, this.physics);
    this.engine.skyNight = sky.night;
    this.engine.skyDay = sky.day;
    this.nightClouds = (sky.night?.getObjectByName('nightClouds') as THREE.Mesh | null) ?? null;
    // main-menu time-of-day choice (persisted; default night)
    this.timeMode = loadTimeMode();

    this.engine.scene.add(this.effects.group);
    this.casings = new CasingManager(this.physics, this.engine.scene);

    // first-person weapon viewmodels: one procedural model per slot (cached)
    for (const w of CONFIG.weapons) {
      const g = buildGunModel(w.key);
      g.position.set(0.26, -0.24, -0.7);
      g.visible = false;
      this.gunModels.set(w.key, g);
      this.engine.camera.add(g);
    }
    this.engine.scene.add(this.engine.camera);

    this.input = new Input(this.engine.renderer.domElement);

    this.player = new Player(this.physics, new THREE.Vector3(0, 0.1, 0));
    this.enemies = new EnemyManager(this.physics, this.engine.scene, this.audio, this.effects);
    // ?debug=1 runtime probe for automated self-tests (scripts/*.mjs)
    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as { __sfProbe?: () => unknown }).__sfProbe = () => this.enemies.probe();
    }
    this.barrels = new BarrelManager(
      this.physics,
      this.engine.scene,
      this.effects,
      this.audio,
      // client mode: barrels don't settle damage locally (host does)
      () => (this.netMode === 'client' ? [] : this.enemies.getEnemies()),
      {
        playerEye: () => this.player.getEye(),
        damagePlayer: (d, src) => this.damagePlayer(d, src),
        onKill: (n) => this.hud.addKill(`<b>${n}</b> ${t('kill.boom')}`),
        onBoom: () => {
          this.heat = Math.max(this.heat, 0.6);
          this.addShake(0.7);
        },
        onBlast: (p, dmg, radius) => this.blastTanks(p, dmg, radius),
      }
    );

    this.weapon = new Weapon(
      this.physics,
      this.player,
      this.effects,
      this.audio,
      () => this.enemies.getEnemies()
    );
    // pre-allocated muzzle flash lights (3 warm points, decayed each frame)
    for (let i = 0; i < 3; i++) {
      const ml = new THREE.PointLight(0xffc070, 0, 9, 1.8);
      this.engine.scene.add(ml);
      this.muzzleLights.push(ml);
    }
    // pooled signal flares (2 concurrent)
    for (let i = 0; i < 2; i++) {
      const fl = new THREE.PointLight(0xffe9b8, 0, 60, 1.7);
      this.engine.scene.add(fl);
      this.flareLights.push(fl);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 14),
        new THREE.MeshBasicMaterial({
          color: 0xfff3d8,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      this.engine.scene.add(disc);
      this.flareDiscs.push(disc);
    }
    this.weapon.onAmmoChange = (mag, reserve, reloading) => this.hud.setAmmo(mag, reserve, reloading);
    this.weapon.onFire = () => {
      this.heat = 1;
      // gunfire gives the player's position away — idle hostiles nearby react
      const pp = this.player.pos;
      this.enemies.alertAt(pp.x, pp.z, 60);
      // squad coordination: nearby allies support toward the player's aim point
      {
        const dir = new THREE.Vector3();
        this.engine.camera.getWorldDirection(dir);
        this.enemies.sharePlayerAim(pp.x + dir.x * 18, pp.z + dir.z * 18, 26);
        // client sees the host's gunfire
        if (this.netMode === 'host') {
          const args = new ArrayBuffer(24);
          const v = new DataView(args);
          const mz = this.weapon.getMuzzleWorld?.() ?? this.player.getEye();
          const d2 = new THREE.Vector3();
          this.engine.camera.getWorldDirection(d2);
          v.setFloat32(0, mz.x); v.setFloat32(4, mz.y); v.setFloat32(8, mz.z);
          v.setFloat32(12, d2.x); v.setFloat32(16, d2.y); v.setFloat32(20, d2.z);
          this.net.sendEvent(NET_EVENTS.SHOT, args);
        }
      }
      this.addShake(0.1);
      // viewmodel recoil impulse + eject a brass casing from the real muzzle
      this.gunKick = this.weapon.def.key === 'bolt' ? 1.3 : 0.7;
      this.engine.camera.updateMatrixWorld(true);
      const mz = this.weapon.getMuzzleWorld?.() ?? null;
      if (mz) {
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.engine.camera.quaternion);
        const fwd = new THREE.Vector3();
        this.engine.camera.getWorldDirection(fwd);
        this.casings.spawn(mz, right, fwd);
        // a brief light flash lights up the walls around the muzzle at night
        const d = this.weapon.def;
        const s2 = Math.min(1, d.damage / 40); // bigger guns throw more light
        this.flashMuzzle(mz, 8 + s2 * 7, 2 + s2 * 2.2);
      }
    };
    this.weapon.onHit = (kill) => {
      this.hud.hitMarker(kill);
      if (kill) {
        this.hud.killBadge();
        if (this.tangoCd <= 0) {
          this.tangoCd = 8;
          this.audio.playVoice('v_tango', 0.7);
        }
      }
    };
    this.weapon.onSwitch = (def) => {
      this.hud.setWeapon(def.key);
      this.updateViewmodel(def);
    };
    this.weapon.getMuzzleWorld = () => {
      const g = this.activeGun;
      if (!g) return null;
      this.engine.camera.updateMatrixWorld(true);
      return g.getObjectByName('muzzle')?.getWorldPosition(new THREE.Vector3()) ?? null;
    };

    // wiring
    this.input.onReload = () => {
      if (!this.driving) this.weapon.reload();
    };
    this.input.onJump = () => {
      if (!this.driving) this.player.queueJump();
    };
    this.input.onWeaponSelect = (slot) => {
      if (!this.driving) this.weapon.switchTo(slot);
    };
    this.input.onWeaponCycle = (dir) => {
      if (!this.driving) this.weapon.switchTo(this.weapon.cur + dir);
    };
    this.input.onInteract = () => this.toggleTankBoarding();
    this.input.onCommand = () => this.cycleSquadCommand();
    this.input.onMapToggle = () => this.toggleFullMap();
    this.input.onFlare = () => this.throwFlare();

    // Touch devices get an on-screen control layer. Pointer lock does not exist
    // on touch, so everything the lock normally handles (looking, pausing) is
    // driven from here instead.
    this.onTouch = isTouchDevice();
    if (this.onTouch) {
      document.body.classList.add('touch');
      this.touch = new TouchControls({
        setTouchMove: (x, z, sprint) => this.input.setTouchMove(x, z, sprint),
        addTouchLook: (dx, dy) => this.input.addTouchLook(dx, dy),
        setTouchFire: (down) => this.input.setTouchFire(down),
        reload: () => this.input.onReload?.(),
        jump: () => this.input.onJump?.(),
        swap: () => this.input.onWeaponCycle?.(1),
        interact: () => this.input.onInteract?.(),
        flare: () => this.input.onFlare?.(),
        pause: () => this.pauseForMenu(),
      });
    }
    this.input.onViewToggle = () => {
      if (this.driving) {
        this.tankCamThird = !this.tankCamThird;
        this.hud.showHint(
          this.tankCamThird
            ? t('tank.chase') + ' · ' + t('tank.exit')
            : t('tank.gunner') + ' · ' + t('tank.exit')
        );
      }
    };
    this.player.onFootstep = () => this.audio.playStep();

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    this.engine.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'paused') this.input.requestLock();
    });

    // --- generate the first map (seed from ?seed= or random) ---
    this.map = generateMap(this.engine.scene, this.physics, this.audio, seedFromURL(), this.quality);
    this.spawnPlayer();
    this.spawnSquads();
    // NOTE: netplay avatars (host: remotePlayer / client: ghostSwarm) are NOT
    // created here — netMode is only known after the HELLO handshake, which
    // happens long after boot. They live in buildWorldAndEntities().
    this.reinLeft = opScale().reserve;
    this.charged = false;
    this.reinTimer = CONFIG.reinforce.every;
    this.barrels.reset(this.map);
    this.spawnTanks();
    this.mission = new Mission(this.engine.scene, this.map);
    this.mission.onCapture = () => this.onCampCaptured();
    this.weather = new Weather(this.engine.scene, this.map.seed, this.quality);
    this.applyMoonlight();
    this.menuCenter.set(0, this.map.terrain.heightAt(0, 0) + 4, 0);
    this.updateSeedLabel();

    // --- screens ---
    const $ = (id: string) => document.getElementById(id)!;
    // Autoplay policy: audio can only start after a user gesture. The first
    // click anywhere (language toggle, settings, anywhere) unlocks the context
    // and brings the menu theme up. startMenu() is idempotent; startRound and
    // quitToMenu manage the switch themselves.
    document.addEventListener(
      'pointerdown',
      () => {
        this.audio.resume();
        this.music.startMenu();
      },
      { once: true }
    );

    $('btnPlay').addEventListener('click', () => {
      // single-player always resets the net flag (a stale netMode='client'
      // would otherwise skip all AI spawning)
      this.netMode = 'off';
      this.newOperation(true);
    });
    $('btnSettings').addEventListener('click', () => this.openSettings('menu'));
    $('btnHelp').addEventListener('click', () => {
      this.showScreen('help');
      this.state = 'menu';
    });
    $('btnHelpBack').addEventListener('click', () => {
      this.showScreen('menu');
      this.state = 'menu';
    });
    // --- netplay room screen ---
    this.net = new Netplay({
      onState: (st, code) => {
        const codeEl = $('net-code');
        const statusEl = $('net-status');
        const msg = $('net-msg');
        if (st === 'signaling') {
          // room code is live the moment the server accepts it
          if (codeEl && code) codeEl.textContent = code;
          if (statusEl) statusEl.textContent = t('net.waiting');
        }
        if (st === 'connecting' && statusEl) statusEl.textContent = t('net.connecting');
        if (st === 'ready' && msg) msg.textContent = t('net.ready');
        if (st === 'error' && msg) msg.textContent = '✕';
      },
      onError: (m) => {
        const msg = $('net-msg');
        if (msg) msg.textContent = `✕ ${m}`;
        // mid-match disconnect: leave the empty battlefield for the lobby
        if (this.state === 'playing') {
          this.showScreen('net');
          this.state = 'menu';
          this.touch?.hide();
        }
      },
      onStart: (seed, pvp) => {
        this.netMode = this.net.mode;
        if (this.dbg) {
          (window as unknown as Record<string, unknown>).__sfStart = {
            mode: this.net.mode, state: this.net.state, seed, pvp,
          };
        }
        this.netPvp = pvp;
        this.pvpScoreSelf = 0;
        this.pvpScoreFoe = 0;
        this.pvpTimeLeft = 600;
        // client adopts the host's operation scale (keys mirror SCALES order)
        if (this.netMode === 'client') {
          const keys = Object.keys(SCALES) as ScaleKey[];
          setScale(keys[this.net.agreedScale] ?? 'standard');
        }
        this.showScreen(null);
        this.newOperation(false, seed);
      },
      onInput: (f) => {
        this.remotePlayer?.driveInput(f.yaw, f.mx, f.mz);
      },
      onSnapshot: (snap) => {
        const w = window as unknown as Record<string, number>;
        w.__sfSnaps = (w.__sfSnaps ?? 0) + 1;
        this.ghostSwarm?.apply(snap.enemies);
        this.ghostSwarm?.applyAllies(snap.allies);
        // host player ghost follows the snapshot position (collider too, PvP)
        const ally = this.ghostSwarm?.ensureAlly(this.netPvp);
        ally?.setTarget(snap.pos[0], snap.pos[1], snap.pos[2]);
      },
      onEvent: (sub, args) => this.onNetEvent(sub, args),
      onRemoteShot: () => {
        // the client pulled the trigger — show it from the ghost's position
        const rp = this.remotePlayer;
        if (!rp) return;
        const eye = rp.eye();
        const dir = new THREE.Vector3(-Math.sin(rp.mesh.rotation.y), 0, -Math.cos(rp.mesh.rotation.y));
        this.effects.tracer(eye.clone(), eye.clone().addScaledVector(dir, 60));
        this.effects.muzzle(eye.clone());
        this.audio.playJeepMG();
      },
    });
    // wire AFTER the orchestrator exists so the claim callback can use it
    // (rebound in bindEvents' re-assignment below)
    $('btnNet').addEventListener('click', () => {
      this.showScreen('net');
      this.state = 'menu';
      this.touch?.hide();
    });
    $('btnNetBack').addEventListener('click', () => {
      this.net.close();
      this.showScreen('menu');
    });
    // hunt/co-op mode picker (host decides; HELLO carries the flag)
    document.querySelectorAll<HTMLButtonElement>('.modeBtn').forEach((b) =>
      b.addEventListener('click', () => {
        document.querySelectorAll<HTMLButtonElement>('.modeBtn').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
      })
    );
    $('btnNetHost').addEventListener('click', () => {
      $('net-choice').classList.add('hidden');
      $('net-join-ui').classList.add('hidden');
      $('net-host-ui').classList.remove('hidden');
      const pvp = document.querySelector<HTMLButtonElement>('.modeBtn.sel')?.dataset.pvp === '1';
      const keys = Object.keys(SCALES) as ScaleKey[];
      void this.net.host((Math.random() * 1e9) | 0, keys.indexOf(opScale().key), pvp);
    });
    $('btnNetJoin').addEventListener('click', () => {
      $('net-choice').classList.add('hidden');
      $('net-host-ui').classList.add('hidden');
      $('net-join-ui').classList.remove('hidden');
    });
    $('btnNetGo').addEventListener('click', () => {
      const code = ($('net-code-input') as HTMLInputElement).value.trim().toUpperCase();
      if (code.length === 4) void this.net.join(code);
    });
    // time-of-day toggle on the main menu — applies live to the backdrop
    document.querySelectorAll<HTMLElement>('.timeBtn').forEach((b) =>
      b.addEventListener('click', () =>
        this.setTimeMode(b.dataset.t === 'day' ? 'day' : 'night')
      )
    );
    this.setTimeMode(this.timeMode); // sync .sel + mood with the saved choice
    // operation-size picker: changes the forces, rebuilds the menu backdrop
    const scaleBtns = document.querySelectorAll<HTMLElement>('.scaleBtn');
    const syncScale = () => {
      scaleBtns.forEach((b) => b.classList.toggle('sel', b.dataset.s === opScale().key));
      const hint = document.querySelector('#scaleDetail [data-i18n]');
      if (hint) hint.textContent = t(`scale.${opScale().key}.hint`);
    };
    scaleBtns.forEach((b) =>
      b.addEventListener('click', () => {
        const k = (b.dataset.s as 'patrol' | 'standard' | 'grand') || 'standard';
        setScale(k);
        syncScale();
        this.rebuildMenuBackdrop();
      })
    );
    syncScale();
    $('setBack').addEventListener('click', () => this.showScreen(this.settingsFrom));
    $('btnResume').addEventListener('click', () => this.resumeFromPause());
    $('btnPauseSettings').addEventListener('click', () => this.openSettings('pause'));
    $('btnQuit').addEventListener('click', () => this.quitToMenu());
    $('btnAgain').addEventListener('click', () => {
      if (this.netMode !== 'off') {
        // net session: a solo restart would desync — back to the lobby
        this.net.close();
        this.netMode = 'off';
        this.showScreen('net');
        this.state = 'menu';
        this.touch?.hide();
        return;
      }
      this.newOperation();
    });
    $('btnEndMenu').addEventListener('click', () => this.quitToMenu());

    // --- settings (persisted to localStorage) ---
    const loadNum = (k: string, fallback: number): number => {
      try {
        const v = Number(localStorage.getItem(k));
        // NOTE: 0 is a meaningful value here (sound toggles store off = 0)
        return Number.isFinite(v) && localStorage.getItem(k) !== null ? v : fallback;
      } catch {
        return fallback;
      }
    };
    const save = (k: string, v: string) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* storage unavailable (private mode / sandbox) — run with defaults */
      }
    };

    const sens = $('sensRange') as HTMLInputElement;
    const vol = $('volRange') as HTMLInputElement;
    const savedSens = loadNum('sf-sens', Math.round(this.player.sensMul * 100));
    const savedVol = loadNum('sf-vol', 80);
    this.player.sensMul = savedSens / 100;
    this.audio.setMasterVolume(savedVol / 100);
    sens.value = String(savedSens);
    sens.addEventListener('input', () => {
      this.player.sensMul = sens.valueAsNumber / 100;
      $('sensVal').textContent = (sens.valueAsNumber / 100).toFixed(1);
      save('sf-sens', String(sens.valueAsNumber));
    });
    vol.value = String(savedVol);
    vol.addEventListener('input', () => {
      this.audio.setMasterVolume(vol.valueAsNumber / 100);
      $('volVal').textContent = vol.value;
      save('sf-vol', vol.value);
    });

    // --- BGM / SFX toggles (persisted; applied whenever the context exists) ---
    const syncToggles = () => {
      const bgmOn = loadNum('sf-bgm', 1) === 1;
      const sfxOn = loadNum('sf-sfx', 1) === 1;
      document.querySelectorAll<HTMLElement>('.bgmBtn').forEach((b) =>
        b.classList.toggle('sel', (b.dataset.m === 'on') === bgmOn)
      );
      document.querySelectorAll<HTMLElement>('.sfxBtn').forEach((b) =>
        b.classList.toggle('sel', (b.dataset.s === 'on') === sfxOn)
      );
      this.music.setMuted(!bgmOn);
      this.audio.setSfxMuted(!sfxOn);
    };
    document.querySelectorAll<HTMLElement>('.bgmBtn').forEach((b) =>
      b.addEventListener('click', () => {
        save('sf-bgm', b.dataset.m === 'on' ? '1' : '0');
        syncToggles();
      })
    );
    document.querySelectorAll<HTMLElement>('.sfxBtn').forEach((b) =>
      b.addEventListener('click', () => {
        save('sf-sfx', b.dataset.s === 'on' ? '1' : '0');
        syncToggles();
      })
    );
    syncToggles();

    // --- mobile-only rows: touch sensitivity + gyro aim ---
    if (this.touch) {
      const sensT = $('sensTouchRange') as HTMLInputElement;
      const savedT = loadNum('sf-sens-touch', 100);
      this.touch.setLookGain(savedT / 100);
      sensT.value = String(savedT);
      sensT.addEventListener('input', () => {
        this.touch!.setLookGain(sensT.valueAsNumber / 100);
        $('sensTouchVal').textContent = (sensT.valueAsNumber / 100).toFixed(1);
        save('sf-sens-touch', String(sensT.valueAsNumber));
      });

      const sensG = $('sensGyroRange') as HTMLInputElement;
      const savedG = loadNum('sf-sens-gyro', 100);
      this.touch.setGyroGain(savedG / 100);
      sensG.value = String(savedG);
      sensG.addEventListener('input', () => {
        this.touch!.setGyroGain(sensG.valueAsNumber / 100);
        $('sensGyroVal').textContent = (sensG.valueAsNumber / 100).toFixed(1);
        save('sf-sens-gyro', String(sensG.valueAsNumber));
      });

      // gyro on/off. The persisted flag is restored silently — on iOS the very
      // first enable needs a user gesture, so a denied boot-restore just stays
      // off until the player flips it in settings (which IS a gesture).
      const syncGyroBtns = () => {
        const on = this.touch!.gyroActive;
        document.querySelectorAll<HTMLElement>('.gyroBtn').forEach((b) =>
          b.classList.toggle('sel', (b.dataset.g === 'on') === on)
        );
      };
      document.querySelectorAll<HTMLElement>('.gyroBtn').forEach((b) =>
        b.addEventListener('click', async () => {
          const want = b.dataset.g === 'on';
          const ok = want ? await this.touch!.setGyroEnabled(true) : this.touch!.setGyroEnabled(false);
          if (!ok) {
            this.hud.showHint(t('hint.gyroDeny'), 3);
            this.touch!.setGyroEnabled(false);
          }
          syncGyroBtns();
          save('sf-gyro', this.touch!.gyroActive ? '1' : '0');
        })
      );
      if (loadNum('sf-gyro', 0) === 1) {
        void this.touch.setGyroEnabled(true).then((ok) => {
          if (!ok) save('sf-gyro', '0');
          syncGyroBtns();
        });
      } else {
        syncGyroBtns();
      }

      // control-layout preset: button + joystick size (small/medium/large)
      const savedBs = loadNum('sf-btn-scale', 1);
      this.touch.setButtonScale(savedBs);
      const syncSize = () =>
        document.querySelectorAll<HTMLElement>('.sizeBtn').forEach((b) =>
          b.classList.toggle('sel', Number(b.dataset.bs) === this.touch!.buttonScale)
        );
      document.querySelectorAll<HTMLElement>('.sizeBtn').forEach((b) =>
        b.addEventListener('click', () => {
          const mult = Number(b.dataset.bs) || 1;
          this.touch!.setButtonScale(mult);
          save('sf-btn-scale', String(mult));
          syncSize();
        })
      );
      syncSize();
    }

    // --- quality tier (auto-detected, but a saved choice wins and persists) ---
    const savedQ = (() => {
      try {
        return localStorage.getItem('sf-quality');
      } catch {
        return null;
      }
    })();
    if (savedQ === 'low' || savedQ === 'med' || savedQ === 'high') {
      this.quality = savedQ;
      this.applyQuality(savedQ);
    }
    const qBtns = document.querySelectorAll<HTMLElement>('.qualBtn');
    const syncQual = () => qBtns.forEach((b) => b.classList.toggle('sel', b.dataset.q === this.quality));
    qBtns.forEach((b) =>
      b.addEventListener('click', () => {
        const q = (b.dataset.q as Quality) || 'high';
        this.applyQuality(q);
        save('sf-quality', q);
        syncQual();
      })
    );
    syncQual();

    // --- touch-device notice (FPS needs mouse + keyboard) ---
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      const dn = document.getElementById('device-note');
      if (dn) {
        dn.textContent = t('note.touch');
        dn.classList.remove('hidden');
      }
    }

    // --- language buttons (settings screen) + floating toggle ---
    document.querySelectorAll<HTMLElement>('.langBtn').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        setLocale((b.dataset.lang as Locale) || 'zh');
      })
    );
    onLocaleChange(() => {
      this.syncLangButtons();
      // spoken lines follow the UI language: 中文说中文，English speaks English
      this.audio.setVoiceLang(getLocale() === 'en' ? 'en' : 'zh');
    });
    this.audio.setVoiceLang(getLocale() === 'en' ? 'en' : 'zh');
    this.syncLangButtons();

    // re-translate dynamic end-screen + menu text when the language flips mid-run
    onLocaleChange(() => {
      if (this.state === 'over') this.fillEnd();
      this.updateSeedLabel();
    });

    // initial HUD values + slot-1 viewmodel
    this.weapon.reset();
    this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
    this.hud.setEnemies(this.enemies.aliveCount());
    this.hud.setSquad(this.enemies.alliesAlive(), opScale().allies);

    // --- diagnostics overlay (toggle with backquote `) ---
    this.diagEl = document.createElement('div');
    this.diagEl.id = 'diag';
    this.diagEl.style.cssText =
      'position:fixed;left:8px;top:8px;font:11px/1.5 ui-monospace,monospace;color:#9fe6a0;background:rgba(0,0,0,0.55);padding:6px 8px;border-radius:6px;white-space:pre;z-index:9999;display:none;pointer-events:none;';
    document.body.appendChild(this.diagEl);
    this.errEl = document.createElement('div');
    this.errEl.id = 'looperr';
    this.errEl.style.cssText =
      'position:fixed;left:50%;top:12px;transform:translateX(-50%);max-width:80vw;font:12px/1.4 ui-monospace,monospace;color:#ffd0d0;background:rgba(60,0,0,0.85);padding:8px 12px;border-radius:8px;z-index:9999;display:none;pointer-events:none;';
    document.body.appendChild(this.errEl);
    window.addEventListener('keydown', (e) => {
      if (e.key === '`' || e.key === '~') {
        this.showDiag = !this.showDiag;
        if (this.diagEl) this.diagEl.style.display = this.showDiag ? 'block' : 'none';
      }
    });
  }

  /** Called once boot completes: reveal the main menu and start the render loop. */
  mount() {
    // settle the map's freshly spawned bodies before the menu orbit shows them
    for (let i = 0; i < 24; i++) this.physics.step();
    this.showScreen('menu');
    this.last = performance.now();
    if (!this.externalLoop) requestAnimationFrame(this.loop);
  }

  /** Engine host: mark match simulating (drives fixedUpdate gating). */
  setHostPlaying(on: boolean) {
    this.hostPlaying = on;
  }

  /** Current screen state for the host state machine. */
  get screenState(): State {
    return this.state;
  }

  // ----- Engine-driven slices (NightRaid systems) -----

  /** Fixed combat step — only while a match is simulating. */
  hostFixedUpdate(dt: number) {
    if (this.state !== 'playing') return;
    this.fixedUpdate(dt);
  }

  /** Variable gameplay: menus, HUD, net, viewmodel, tactical map. */
  hostGameplayFrame(ft: number) {
    if (this.state === 'menu') {
      this.updateMenuCamera(ft);
      for (const g of this.gunModels.values()) g.visible = false;
    }
    if (this.state === 'intro') this.updateIntro(ft);

    const hudEl = document.getElementById('hud');
    if (hudEl) {
      hudEl.style.display =
        this.state === 'playing' || this.state === 'paused' ? '' : 'none';
    }

    if (this.state === 'playing' || this.state === 'paused') {
      this.tactical.update(
        this.player.pos.x,
        this.player.pos.z,
        this.player.yaw,
        this.enemyTargets(),
        this.map.obstacles,
        CONFIG.map.half,
        this.barrels.getBlips(),
        this.mission.exfilBlip(),
        this.map.ammoDumps.map((d, i) => ({ x: d.x, z: d.z, used: this.resupplied.has(i) }))
      );
    }
    if (this.state === 'playing') {
      if (this.driving) {
        for (const g of this.gunModels.values()) g.visible = false;
        this.hud.setSpread(0);
      } else {
        const mv = this.input.moveAxis();
        const moving = mv.x !== 0 || mv.z !== 0;
        const spread = 4 + this.weapon.recoilLevel * 26 + (moving ? (mv.sprint ? 9 : 5) : 0);
        this.hud.setSpread(spread);
        this.animateViewmodel(ft);
      }
    }
    if (this.shake > 0.001) this.shake = Math.max(0, this.shake - ft * 2.2);
    if (this.state === 'playing' && this.shake > 0.001) {
      const s = this.shake;
      const cam = this.engine.camera;
      cam.rotation.z += (Math.random() - 0.5) * s * 0.05;
      cam.rotation.x += (Math.random() - 0.5) * s * 0.03;
      cam.position.x += (Math.random() - 0.5) * s * 0.07;
      cam.position.y += (Math.random() - 0.5) * s * 0.07;
    }
    if (this.state === 'playing' && this.fullmapOpen) {
      this.tactical.drawFullMap(
        this.player.pos.x,
        this.player.pos.z,
        this.player.yaw,
        this.enemies.getSoldiers(),
        this.map.obstacles,
        CONFIG.map.half,
        this.map.ammoDumps.map((d, i) => ({ x: d.x, z: d.z, used: this.resupplied.has(i) })),
        this.map.camp,
        this.map.base
      );
    }
  }

  /** Pooled VFX + ballistic debris → EffectsSystem (A4). */
  hostEffectsFrame(_ft: number) {
    // no-op shell until A12
  }

  /** VFX collaborators for EffectsSystem. */
  get vfx() {
    return {
      effects: this.effects,
      fires: this.map.fires,
      plumes: this.map.plumes,
      casings: this.casings,
    };
  }

  /** Weather + muzzle/flare light decay → AtmosphereSystem (A5). */
  hostAtmosphereFrame(_ft: number, _playing: boolean) {
    // no-op shell until A12
  }

  /** Atmosphere collaborators for AtmosphereSystem. */
  get atmosphere() {
    return {
      state: this.state,
      weather: this.weather,
      cameraPos: this.engine.camera.position,
      muzzleLights: this.muzzleLights,
      nightClouds: this.nightClouds,
    };
  }

  // fadeMuzzleLights lives on AtmosphereSystem (A5)

  /** Tier auto-downgrade handled by QualityAutoSystem (A2). */
  hostQualityAuto(_ft: number) {
    // retained as a no-op shell until A12; QualityAutoSystem owns the logic
  }

  /** Present the frame + diagnostics → RenderPresentSystem (A3). */
  hostPresent(_ft: number) {
    // retained as a no-op shell until A12; RenderPresentSystem owns present+diag
  }

  /** Sync WebGPU present (three r186 sync render path). */
  presentFrame(): void {
    this.engine.renderer.render(this.engine.scene, this.engine.camera);
  }

  /** FPS EMA sample written by RenderPresentSystem. */
  noteFps(instant: number): void {
    this.fps += (instant - this.fps) * 0.1;
  }

  /** React to QualityController render-scale change while playing. */
  syncRenderScale(): void {
    if (this.state === 'playing' && this.qualityCtrl.renderScale !== this.lastRenderScale) {
      this.lastRenderScale = this.qualityCtrl.renderScale;
      this.onResize();
    }
  }

  get diagPanel(): HTMLElement | null {
    return this.diagEl;
  }

  /** Counters for the diagnostics overlay. */
  diagCounts(): { bodies: number; colliders: number; fx: number; enemiesAlive: number; enemiesTotal: number; state: string } {
    const w = this.physics.world;
    return {
      bodies: w.bodies.len(),
      colliders: w.colliders.len(),
      fx: this.effects.count(),
      enemiesAlive: this.enemies.aliveCount(),
      enemiesTotal: this.enemies.getEnemies().length,
      state: this.state,
    };
  }

  noteSlowFrame(slow: boolean): void {
    if (slow) this.slowStreak++;
    else this.slowStreak = 0;
    if (this.slowStreak >= 4 && this.diagEl) this.diagEl.style.display = 'block';
  }

  // ---------- screens ----------

  private showScreen(id: ScreenId | null) {
    for (const s of ['menu', 'settings', 'pause', 'end', 'help', 'net'] as const) {
      document.getElementById(s)!.classList.toggle('hidden', s !== id);
    }
    // any full-screen panel hides the touch overlay; beginPlaying brings it back
    if (id !== null) this.touch?.hide();
  }

  private syncLangButtons() {
    const cur = getLocale();
    document.querySelectorAll<HTMLElement>('.langBtn').forEach((b) =>
      b.classList.toggle('sel', b.dataset.lang === cur)
    );
  }

  private openSettings(from: Exclude<ScreenId, 'settings'>) {
    this.settingsFrom = from;
    this.showScreen('settings');
  }

  /** Show only the freshly selected weapon's viewmodel. */
  private updateViewmodel(def: WeaponDef) {
    for (const [k, g] of this.gunModels) g.visible = k === def.key;
    this.activeGun = this.gunModels.get(def.key) ?? null;
  }

  /**
   * Render-frame viewmodel motion: a kick that spikes on fire and settles, plus
   * a subtle walk/sprint bob. Runs on the active gun group only while playing;
   * the base resting pose is (0.26, -0.24, -0.7) from construction.
   */
  private animateViewmodel(ft: number) {
    const g = this.activeGun;
    if (!g) return;
    this.gunKick = Math.max(0, this.gunKick - ft * 8);
    const k = this.gunKick;
    const mv = this.input.moveAxis();
    const moving = mv.x !== 0 || mv.z !== 0;
    if (moving) this.bobPhase += ft * (mv.sprint ? 12 : 7.5);
    const amp = moving ? (mv.sprint ? 1 : 0.55) : 0;
    const b = Math.sin(this.bobPhase);
    g.position.set(
      0.26 + Math.cos(this.bobPhase) * 0.014 * amp + (Math.random() - 0.5) * k * 0.012,
      -0.24 + Math.abs(b) * 0.02 * amp + k * 0.015,
      -0.7 + k * 0.07
    );
    g.rotation.set(
      k * 0.16, // muzzle kicks up with the shot, settles back
      0,
      Math.cos(this.bobPhase) * 0.022 * amp + (Math.random() - 0.5) * k * 0.04
    );
  }

  /** Player spawn: their base camp at one end of the map, on the terrain. */
  private spawnPos(): THREE.Vector3 {
    const b = this.map.base;
    return new THREE.Vector3(b.x, this.map.terrain.heightAt(b.x, b.z) + 0.1, b.z);
  }

  /** Reset the player at their base, facing the hostile camp across the map. */
  private spawnPlayer() {
    this.player.reset(this.spawnPos());
    const b = this.map.base;
    const c = this.map.camp;
    this.player.yaw = Math.atan2(-(c.x - b.x), -(c.z - b.z));
  }

  // ---------- flow ----------

  /**
   * Begin a match. From the main menu we run a cinematic camera fly-in (`intro`
   * state) so the jump from the orbiting menu backdrop to first person reads as
   * arriving on the battlefield rather than a hard cut. `newOperation` skips the
   * fly-in (cinematic=false) and drops straight into play.
   */
  private startMatch(cinematic = true) {
    this.audio.resume();
    this.music.startRound(this.map.seed);
    this.music.playStinger();
    this.heat = 0;
    this.mood = 'calm';
    // touch devices never lock the pointer — looking is a drag, pausing is a button
    if (!this.onTouch) this.input.requestLock();
    this.showScreen(null);
    if (cinematic) {
      // Capture the current menu-orbit camera pose and ease it into the eyes.
      this.introFrom.copy(this.engine.camera.position);
      this.introT = 0;
      this.state = 'intro';
    } else {
      this.beginPlaying();
    }
  }

  /** Reveal HUD/tactical/minimap + spawn hint, and flip into the playing state. */
  private beginPlaying() {
    this.state = 'playing';
    if (this.dbg) {
      (window as unknown as Record<string, unknown>).__sfPlay = {
        netState: this.net.state, netMode: this.netMode, pvp: this.netPvp,
      };
    }
    this.tactical.show(true);
    this.touch?.show();
    if (!this.enterVoiced) {
      this.enterVoiced = true;
      this.audio.playVoice('v_enter', 0.8);
    }
    this.hud.showCrosshair();
    this.updateViewmodel(this.weapon.def);
    const brief = this.mission.view(opScale().enemies, opScale().enemies);
    const tactic = this.timeMode === 'night' ? t('tactic.night') : t('tactic.day');
    this.hud.showHint(
      `<b>${t(brief.titleKey)}</b> — ${t(brief.descKey)}<br />${t('wx.label')} ${t('weather.' + this.weather.kind)} · ${tactic} · ${t('hint.start')}`
    );
    setTimeout(() => {
      if (this.state === 'playing') this.hud.hideHint();
    }, 3500);
  }

  /**
   * Cinematic fly-in: ease the camera from wherever the menu orbit left it down
   * into the player's eye position, looking along the player's facing. Smoothstep
   * gives an accelerate-then-settle feel. At t=1 the pose matches exactly what
   * `player.update` sets on the first playing frame, so there's no snap.
   */
  private updateIntro(ft: number) {
    this.introT += ft;
    const k = Math.min(this.introT / this.introDur, 1);
    const e = k * k * (3 - 2 * k); // smoothstep
    const cam = this.engine.camera;
    const eye = this.player.getEye();
    const dir = new THREE.Vector3(
      -Math.cos(this.player.pitch) * Math.sin(this.player.yaw),
      Math.sin(this.player.pitch),
      -Math.cos(this.player.pitch) * Math.cos(this.player.yaw)
    );
    const startTarget = new THREE.Vector3(
      this.menuCenter.x,
      this.menuCenter.y + 1.5,
      this.menuCenter.z
    );
    const target = startTarget.lerp(eye.clone().add(dir), e);
    cam.position.lerpVectors(this.introFrom, eye, e);
    cam.lookAt(target);
    if (this.introT >= this.introDur) {
      if (!this.onTouch && !this.input.locked) {
        // Pointer lock was refused / Esc'd during the fly-in (onLockChange can't
        // catch it while in the intro state) — park on the pause screen so the
        // player can click back in instead of landing in play without a lock.
        this.state = 'paused';
        this.music.setPaused(true);
        this.tactical.show(true);
        this.hud.hideCrosshair();
        this.showScreen('pause');
      } else {
        this.beginPlaying();
      }
    }
  }

  /**
   * Pause from the on-screen button. Phones have no Esc key and no pointer
   * lock to lose, so the pause has to be an explicit action.
   */
  private pauseForMenu() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.music.setPaused(true);
    this.hud.hideCrosshair();
    this.touch?.hide();
    this.showScreen('pause');
  }

  /** Resume from the pause screen (works with or without pointer lock). */
  private resumeFromPause() {
    if (this.onTouch) {
      this.state = 'playing';
      this.music.setPaused(false);
      this.hud.showCrosshair();
      this.touch?.show();
      this.showScreen(null);
    } else {
      // desktop re-enters through pointer lock; onLockChange flips the state
      this.input.requestLock();
    }
  }

  private onLockChange() {
    // Touch devices never hold the lock — pausing/resuming is button-driven.
    if (this.onTouch) return;
    if (this.state === 'playing' && !this.input.locked) {
      this.state = 'paused';
      this.music.setPaused(true);
      this.hud.hideCrosshair();
      this.showScreen('pause');
    } else if (this.input.locked && this.state === 'paused') {
      this.state = 'playing';
      this.music.setPaused(false);
      this.hud.showCrosshair();
      this.showScreen(null);
    }
  }

  private quitToMenu() {
    if (this.windOn) {
      this.audio.stopWind();
      this.windOn = false;
    }
    this.music.startMenu();
    document.exitPointerLock?.();
    this.leaveTank(true);
    this.music.stop();
    this.tactical.show(false);
    this.hud.hideObjective();
    this.hud.hideCrosshair();
    this.state = 'menu';
    this.showScreen('menu');
  }

  // ---------- tanks (H package) ----------

  /** Dispose both tanks and spawn fresh ones on the current map's spots. */
  private spawnTanks() {
    this.disposeTanks();
    const scene = this.engine.scene;
    const mkHooks = () => ({
      effects: this.effects,
      audio: this.audio,
      physics: this.physics,
      terrain: this.map.terrain,
      getEnemies: () => this.enemyTargets(),
      damagePlayer: (d: number, src?: { x: number; z: number }) => {
        // armoured: while driving, hull damage comes from shells/blasts, not
        // splash routed through the driver
        if (this.driving) return;
        this.damagePlayer(d, src);
      },
      muzzleFlash: (pos: THREE.Vector3, radius: number, strength: number) =>
        this.flashMuzzle(pos, radius, strength),
      addShake: (amount: number) => this.addShake(amount),
      onTankDestroyed: (_tk: Tank, playerInside: boolean) => {
        if (playerInside) {
          // the driver rides the ammo rack — kill
          this.damagePlayer(9999);
          return;
        }
        this.hud.addKill(`<b>${t('tank.destroyed')}</b>`);
      },
    });

    // scout jeep: parked near the player's flag, quick recon to the front
    const b = this.map.base;
    const jx = b.x + Math.cos(Math.random() * Math.PI * 2) * 9;
    const jz = b.z + Math.sin(Math.random() * Math.PI * 2) * 9;
    this.jeep = new Jeep(
      { ...mkHooks(), onJeepDestroyed: () => this.onJeepDestroyed() },
      jx,
      jz,
      Math.random() * Math.PI * 2
    );
    this.jeep.attach(scene);

    const spot = this.map.tankSpots;
    if (spot.player) {
      this.playerTank = new Tank(mkHooks(), spot.player.x, spot.player.z, Math.random() * Math.PI * 2);
      this.playerTank.attach(scene);
    }
    if (spot.enemy) {
      this.enemyTank = new Tank(
        mkHooks(),
        spot.enemy.x,
        spot.enemy.z,
        Math.random() * Math.PI * 2,
        { ai: true }
      );
      this.enemyTank.attach(scene);
    }
  }

  private disposeTanks() {
    this.leaveTank(true);
    if (this.jeep) {
      this.jeep.dispose(this.engine.scene, this.physics);
      this.jeep = null;
    }
    if (this.playerTank) {
      this.playerTank.dispose(this.engine.scene);
      this.playerTank = null;
    }
    if (this.enemyTank) {
      this.enemyTank.dispose(this.engine.scene);
      this.enemyTank = null;
    }
  }

  private static readonly COMMANDS: Array<'follow' | 'assault' | 'hold'> = [
    'follow',
    'assault',
    'hold',
  ];

  /** X: cycle the squad command. The squad confirms over the radio (TTS). */
  private cycleSquadCommand() {
    if (this.state !== 'playing') return;
    if (!this.enemies.alliesAlive()) {
      this.hud.showHint(t('cmd.nobody'), 2);
      return;
    }
    const cur = this.enemies.command;
    const cmds = Game.COMMANDS;
    const next = cmds[(cmds.indexOf(cur) + 1) % cmds.length];
    this.enemies.setCommand(next);
    this.hud.addKill(`<b>${t('cmd.' + next)}</b>`);
    this.hud.showHint(`${t('cmd.label')} — <b>${t('cmd.' + next)}</b>`, 2);
    this.audio.playVoice(
      next === 'assault' ? 'v_cn_assault' : next === 'hold' ? 'v_cn_guard' : 'v_cn_follow',
      0.9
    );
  }

  /** F: board the nearby driveable tank / dismount when already driving. */
  private toggleTankBoarding() {
    if (this.state !== 'playing') return;
    if (this.driving) {
      this.leaveTank(false);
      return;
    }
    // CLIENT: interactions are requests the host settles
    if (this.netMode === 'client') {
      const pp = this.player.pos;
      if (this.ghostSwarm?.downedAllyNear(pp.x, pp.z, 2.6)) {
        this.net.sendEvent(NET_EVENTS.INTERACT, new Uint8Array([0]).buffer);
        return;
      }
      const dumpNear = this.map.ammoDumps.some((d) => Math.hypot(d.x - pp.x, d.z - pp.z) < 3);
      if (dumpNear) {
        this.net.sendEvent(NET_EVENTS.INTERACT, new Uint8Array([1]).buffer);
        return;
      }
      return; // no vehicles for the client yet (stage-2)
    }
    // rescuing a downed squadmate outranks everything else
    const downed = this.enemies.nearestDowned(this.player.pos.x, this.player.pos.z, 2.6);
    if (downed) {
      downed.revive();
      this.audio.playVoice('v_nice', 0.8);
      this.hud.addKill(`<b>${t('rescue.done')}</b>`);
      return;
    }
    // nearest ammo dump first (it's a dedicated landmark; vehicles can wait)
    if (this.tryResupply()) return;
    // nearest boardable vehicle wins: jeep first (it's usually closer to base)
    const jp = this.jeep;
    if (jp?.alive) {
      const d = Math.hypot(jp.pos.x - this.player.pos.x, jp.pos.z - this.player.pos.z);
      if (d <= 4.2) {
        this.driving = jp;
        jp.driver = true;
        this.audio.startEngine();
        this.player.body.setEnabled(false);
        this.player.pos.set(jp.pos.x, this.map.terrain.heightAt(jp.pos.x, jp.pos.z) + 0.3, jp.pos.z);
        this.tankCamThird = true;
        this.hud.hideCrosshair();
        this.hud.showHint(t('jeep.driveHint'), 4);
        return;
      }
    }
    const tank = this.playerTank;
    if (!tank?.alive) return;
    const tp = tank.pos;
    const d = Math.hypot(tp.x - this.player.pos.x, tp.z - this.player.pos.z);
    if (d > 4.2) return;
    // board: park the player body inside the hull (hidden from enemy fire)
    this.driving = tank;
    tank.driver = true;
    this.audio.startEngine();
    this.player.body.setEnabled(false);
    this.player.pos.set(tp.x, this.map.terrain.heightAt(tp.x, tp.z) + 0.3, tp.z);
    this.tankCamThird = true;
    this.hud.hideCrosshair();
    this.hud.showHint(t('tank.driveHint'), 4);
  }

  /** One-shot resupply at an ammo dump: tops every reserve back up. */
  private tryResupply(): boolean {
    const pp = this.player.pos;
    const dumps = this.map.ammoDumps;
    for (let i = 0; i < dumps.length; i++) {
      if (this.resupplied.has(i)) continue;
      const d = dumps[i];
      if (Math.hypot(d.x - pp.x, d.z - pp.z) < 3) {
        this.resupplied.add(i);
        this.weapon.refillAllReserves();
        this.audio.playReload();
        this.hud.showHint(t('resupply.done'), 2.5);
        return true;
      }
    }
    return false;
  }

  /** The scout jeep burned with the driver aboard: eject wounded, not dead. */
  private onJeepDestroyed() {
    if (this.driving instanceof Jeep) {
      this.leaveTank(false);
      this.damagePlayer(40);
      this.hud.addKill(`<b>${t('jeep.destroyed')}</b>`);
    }
  }

  /** Dismount from the current tank (keep = stay at menu; else step out). */
  private leaveTank(keepPlayer: boolean) {
    if (!this.driving) return;
    const tank = this.driving;
    this.driving = null;
    tank.driver = false;
    this.audio.stopEngine();
    // restore the player body at the tank's side
    try {
      this.player.body.setEnabled(true);
    } catch {
      /* mid-teardown */
    }
    // health bar back to the soldier
    this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
    this.hud.setHealthLabel(t('hud.health'));
    if (!keepPlayer) {
      const tp = tank.pos;
      const a = tank.yaw + Math.PI / 2; // right side of the hull
      const px = tp.x + Math.cos(a) * 3.2;
      const pz = tp.z + Math.sin(a) * 3.2;
      const gy = this.map.terrain.heightAt(px, pz);
      this.player.pos.set(px, gy + 0.4, pz);
      this.player.yaw = tank.yaw + Math.PI;
      // the soldier's body is DYNAMIC: setNextKinematicTranslation is a no-op
      // on it, and re-enabling at the old transform dropped people under the
      // terrain. Force the transform and zero the velocity instead.
      this.player.body.setTranslation({ x: px, y: gy + 0.6, z: pz }, true);
      this.player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.hud.showCrosshair();
    this.hud.hideHint();
    this.updateViewmodel(this.weapon.def);
  }

  /** HE blast (oil drums etc.) damages nearby tanks — drums are AT weapons. */
  private blastTanks(p: THREE.Vector3, dmg: number, radius: number) {
    for (const t of [this.playerTank, this.enemyTank]) {
      if (!t?.alive) continue;
      const tp = t.pos;
      const d = Math.hypot(tp.x - p.x, tp.z - p.z);
      if (d < radius) {
        const f = Math.max(0, 1 - d / radius) + 0.25;
        t.blastHit(Math.round(dmg * 4 * f)); // high-explosive vs armour
      }
    }
  }

  /** Spawn both squads: hostiles at their camp, allies around the player camp. */
  private spawnSquads() {
    // CLIENT: no local AI — enemies/allies arrive as network ghosts
    if (this.netMode === 'client') {
      this.enemies.clear();
      return;
    }
    // PvP hunt: pure FFA — no AI soldiers on either side
    if (this.netMode === 'host' && this.netPvp) {
      this.enemies.clear();
      return;
    }
    const sc = opScale();
    // medkit drop / heal wiring for the whole squad system
    this.enemies.onDeath = (pos) => this.enemies.spawnMedkit(pos);
    this.enemies.onResupply = (amount) => {
      const healed = this.player.heal(amount);
      if (healed > 0) {
        this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
        this.audio.playReload();
      }
    };
    // THREE-PRONGED PUSH: hostiles are split into left / centre / right prongs
    // along the camp→base axis, each advancing toward its own offset waypoint.
    // This replaces the old single-line rush — a big battle reads as a
    // coordinated assault with wings, not a conga line.
    const c = this.map.camp;
    const b = this.map.base;
    const axisX = b.x - c.x;
    const axisZ = b.z - c.z;
    const axisLen = Math.hypot(axisX, axisZ) || 1;
    const ax = axisX / axisLen;
    const az = axisZ / axisLen;
    const prongMid = (side: number) => ({
      x: c.x + ax * axisLen * 0.55 + -az * side * 24,
      z: c.z + az * axisLen * 0.55 + ax * side * 24,
    });
    const prongs = [prongMid(0), prongMid(-1), prongMid(1)];
    // sort spawns into prongs by their lateral offset from the axis
    const lanes: Array<Array<THREE.Vector3>> = [[], [], []];
    for (const sp of this.map.spawnPoints) {
      const lat = (sp.x - c.x) * -az + (sp.z - c.z) * ax;
      const lane = lat < -8 ? 1 : lat > 8 ? 2 : 0;
      lanes[lane].push(sp);
    }
    this.enemies.clear();
    lanes.forEach((pts, i) => {
      if (!pts.length) return;
      this.enemies.spawnHostiles(pts, this.map.camp, sc.dmgMul, sc.hpMul, prongs[i]);
    });
    const pts = this.map.allySpawns.length
      ? this.map.allySpawns
      : [new THREE.Vector3(3, 0.1, 0), new THREE.Vector3(-2, 0.1, 2), new THREE.Vector3(-2, 0.1, -2)];
    this.enemies.spawnAllies(pts);
  }

  private newOperation(cinematic = false, seedOverride?: number) {
    // tell the player WHY the page froze for a beat: the whole battlefield is
    // regenerated synchronously (terrain, props, squads, weather)
    this.hud.showHint(t('op.deploy'), 6);
    // let the hint paint before the synchronous generation blocks the frame
    setTimeout(() => {
      this.buildWorldAndEntities(seedOverride);
      this.kills = 0;
      this.matchTime = 0;
      this.heat = 0;
      this.timedOut = false;
      this.lastAlive = opScale().enemies;
      this.lastSquadAlive = opScale().allies;
      // per-match voice one-shots re-arm with the fresh operation
      this.enterVoiced = false;
      this.losingVoiced = false;
      this.holdVoiced = false;
      this.tangoCd = 0;
      this.slWarnCd = 0;
      this.streakPlayed = 0;
      this.resupplied.clear();
      this.dumpHintOn = false;
      this.startMatch(cinematic);
    }, 60);
  }

  /** Regenerate map + squads + mission from the current scale/seed roll.
   *  Shared by newOperation (drop into combat) and the menu scale picker
   *  (rebuild the backdrop so the new force sizes are visible).
   *  `seedOverride` threads the netplay handshake seed through so host and
   *  client roll the SAME map + mission — without it the two machines
   *  silently diverged (ghost enemies walking on the wrong terrain). */
  private buildWorldAndEntities(seedOverride?: number) {
    this.effects.clearDecals(); // fresh map = fresh walls
    this.disposeTanks();
    clearMap(this.engine.scene, this.physics, this.map);
    this.map = generateMap(this.engine.scene, this.physics, this.audio, seedOverride ?? ((Math.random() * 1e9) | 0), this.quality);
    this.spawnPlayer();
    this.spawnSquads();
    // --- netplay avatars — created HERE, where netMode is actually known ---
    if (this.netMode === 'host') {
      this.remotePlayer?.dispose(this.engine.scene, this.physics);
      const sp = this.map.allySpawns[0] ?? new THREE.Vector3(this.map.base.x + 3, 0.1, this.map.base.z);
      this.remotePlayer = new RemotePlayer(
        this.physics,
        this.engine.scene,
        this.map.terrain,
        sp.x,
        sp.z,
        (dmg, from) => {
          // local AI/host fire hurt the remote player → settle on the client
          const args = new ArrayBuffer(2);
          const v = new DataView(args);
          v.setUint8(0, Math.min(255, dmg));
          v.setFloat32(1, 0);
          this.net.sendEvent(NET_EVENTS.HIT, args);
          void from;
          // PvP: the ghost died to our hand — score and auto-revive it
          if (this.netPvp && this.remotePlayer && this.remotePlayer.hp <= 0) {
            this.pvpScoreSelf++;
            this.remotePlayer.hp = 100;
            this.hud.setPvpScore(this.pvpScoreSelf, this.pvpScoreFoe);
            const sc = new ArrayBuffer(2);
            new DataView(sc).setUint8(0, this.pvpScoreSelf);
            new DataView(sc).setUint8(1, this.pvpScoreFoe);
            this.net.sendEvent(NET_EVENTS.SCORE, sc);
          }
        }
      );
    } else {
      this.remotePlayer?.dispose(this.engine.scene, this.physics);
      this.remotePlayer = null;
    }
    if (this.netMode === 'client') {
      this.ghostSwarm?.clear();
      this.ghostSwarm = new GhostSwarm(this.physics, this.engine.scene, this.map.terrain);
      this.ghostSwarm.onClaim = (id, dmg) => {
        // client weapon hit → claim to host (host settles damage)
        const args = new ArrayBuffer(5);
        const v = new DataView(args);
        v.setUint8(0, id);
        v.setUint8(1, Math.min(255, dmg));
        v.setFloat32(2, 0);
        this.net.sendEvent(NET_EVENTS.HIT, args);
      };
    }
    this.barrels.reset(this.map);
    this.spawnTanks();
    this.mission.dispose();
    this.mission = new Mission(this.engine.scene, this.map);
    this.mission.onCapture = () => this.onCampCaptured();
    this.weather.dispose();
    this.weather = new Weather(this.engine.scene, this.map.seed, this.quality);
    this.applyMoonlight();
    this.weapon.reset();
    this.updateSeedLabel();
    this.hud.clearKillfeed();
    this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
    this.hud.setAmmo(this.weapon.mag, this.weapon.reserve, false);
    this.hud.setEnemies(this.enemies.aliveCount());
    this.hud.setSquad(this.enemies.alliesAlive(), opScale().allies);
    this.kills = 0;
    this.matchTime = 0;
    this.heat = 0;
    this.timedOut = false;
    this.lastAlive = opScale().enemies;
    this.lastSquadAlive = opScale().allies;
  }

  /** Scale picker on the main menu: keep showing the menu, just re-roll the
   *  battlefield behind it so the new force sizes are visible. */
  private rebuildMenuBackdrop() {
    if (this.state !== 'menu') return;
    this.buildWorldAndEntities();
    this.menuCenter.set(0, this.map.terrain.heightAt(0, 0) + 4, 0);
    // settle the freshly spawned bodies onto the terrain for the orbit camera
    for (let i = 0; i < 24; i++) this.physics.step();
  }

  private damagePlayer = (d: number, source?: { x: number; z: number }) => {
    if (!this.player.alive) return;
    // driving? the armour takes it (tank HP), not the driver — a shell or
    // blast that pens the hull goes through Tank.destroy() instead
    if (this.driving) return;
    this.heat = 1;
    const fatal = this.player.damage(d);
    this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
    this.hud.flashDamage();
    this.addShake(Math.min(1.4, 0.35 + d / 120));
    if (source) {
      const dx = source.x - this.player.pos.x;
      const dz = source.z - this.player.pos.z;
      const yaw = this.player.yaw;
      const fwd = dx * -Math.sin(yaw) + dz * -Math.cos(yaw);
      const right = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
      this.hud.damageDirection(Math.atan2(right, fwd));
    }
    this.audio.playPlayerHurt();
    if (fatal) {
      if (this.netPvp) {
        // hunt mode: dying hands the foe a point, respawn in 3s at a random spawn
        this.pvpScoreFoe++;
        this.pvpRespawnT = 3;
        this.hud.setPvpScore(this.pvpScoreSelf, this.pvpScoreFoe);
        const sc = new ArrayBuffer(2);
        new DataView(sc).setUint8(0, this.pvpScoreSelf);
        new DataView(sc).setUint8(1, this.pvpScoreFoe);
        this.net.sendEvent(NET_EVENTS.SCORE, sc);
      } else {
        this.gameOver(false);
      }
    }
  };

  // updateAutoQuality moved to QualityAutoSystem (A2)

  /**
   * Amber arc toward the freshest enemy trigger pull — fires every frame an
   * enemy has pulled the trigger within the last ~90ms, so a burst keeps the
   * arc pinned and it fades ~700ms after the shooting stops. Misses included:
   * knowing WHERE fire comes from is the point, not just being hit by it.
   */
  private updateFireIndicators() {
    const now = performance.now() / 1000;
    let best: { x: number; z: number } | null = null;
    let bestAge = Infinity;
    for (const e of this.enemies.getEnemies()) {
      if (!e.alive) continue;
      const age = now - e.lastShot;
      if (age < bestAge) {
        bestAge = age;
        const t = e.body.translation();
        best = { x: t.x, z: t.z };
      }
    }
    if (!best || bestAge > 0.09) return;
    const dx = best.x - this.player.pos.x;
    const dz = best.z - this.player.pos.z;
    const yaw = this.player.yaw;
    const fwd = dx * -Math.sin(yaw) + dz * -Math.cos(yaw);
    const right = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
    this.hud.gunfireDirection(Math.atan2(right, fwd));
  }

  /** Kill-streak milestones: one-shot radio flourish as the count climbs. */
  private checkStreak() {
    const nodes: Array<[number, string, string]> = [
      [3, 'v_streak3', 'streak.3'],
      [5, 'v_streak5', 'streak.5'],
      [8, 'v_streak8', 'streak.8'],
    ];
    for (const [n, voice, key] of nodes) {
      if (this.kills === n && this.streakPlayed < n) {
        this.streakPlayed = n;
        this.hud.addKill(`<b>${t(key)}</b>`);
        this.audio.playVoice(voice, 0.9);
        return;
      }
    }
  }

  /** Add camera-shake trauma (clamped). Decays in the render loop. */
  private addShake(amount: number) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  /** Apply a quality tier live: shadows, shadow-map size, pixel-ratio cap, fog reach. */
  applyQuality(q: Quality) {
    this.quality = q;
    this.qualityCtrl.setTier(q);
    const s = QUALITY[q];
    const sm = (this.engine.renderer as { shadowMap?: { enabled: boolean; needsUpdate?: boolean } })
      .shadowMap;
    if (sm) {
      sm.enabled = s.shadows;
      sm.needsUpdate = true;
    }
    this.onResize();
    const m = this.engine.moon;
    m.castShadow = s.shadows;
    m.shadow.mapSize.set(s.shadowSize, s.shadowSize);
    if (m.shadow.map) {
      m.shadow.map.dispose();
      m.shadow.map = null;
    }
    // rescale the fog reach to the new tier and re-compose the day/night look
    if (this.weather) {
      this.weather.setFogMul(s.fogFarMul);
      this.applyMoonlight();
    }
  }

  private gameOver(victory: boolean) {
    if (this.state === 'over') return;
    // ?debug=1: record WHO ended the match (call site), for net e2e diagnosis
    if (this.dbg) {
      (window as unknown as Record<string, unknown>).__sfEnd = {
        victory,
        netMode: this.netMode,
        pvp: this.netPvp,
        netState: this.net.state,
        hasRemote: !!this.remotePlayer,
        stack: (new Error().stack ?? '').split('\n').slice(1, 5).join(' | ').slice(0, 420),
      };
    }
    // host decides the outcome → the client follows over the wire
    if (this.netMode === 'host') {
      this.net.sendEvent(NET_EVENTS.MISSION, new Uint8Array([victory ? 1 : 0]).buffer);
    }
    this.audio.playVoice(victory ? 'v_secured' : 'v_lost', 0.9);
    if (this.windOn) {
      this.audio.stopWind();
      this.windOn = false;
    }
    this.leaveTank(true); // a dead tank may have ejected the driver — clean up
    this.state = 'over';
    this.victory = victory;
    document.exitPointerLock?.();
    this.music.setPaused(false);
    this.tactical.show(false);
    this.hud.hideObjective();
    this.hud.setHealthLabel(t('hud.health'));
    if (victory) this.music.playWin();
    else this.music.playLose();
    this.fillEnd();
    this.hud.hideCrosshair();
    this.showScreen('end');
  }

  private fillEnd() {
    const el = document.getElementById('endTitle')!;
    el.textContent = t(this.victory ? 'end.win' : this.timedOut ? 'end.timeout' : 'end.lose');
    el.classList.toggle('win', this.victory);
    el.classList.toggle('lose', !this.victory);
    const mm = String(Math.floor(this.matchTime / 60)).padStart(2, '0');
    const ss = String(Math.floor(this.matchTime % 60)).padStart(2, '0');
    document.getElementById('endStats')!.textContent =
      `${t('stat.kills')} ${this.kills} · ${t('stat.time')} ${mm}:${ss} · SEED ${this.map.seed}`;
  }

  // ---------- menu backdrop camera ----------

  /**
   * Slow cinematic orbit above the battlefield centre, used as the live
   * backdrop behind the main menu (and behind Settings when opened from it).
   * Deliberately separate from the player camera: the player rig only drives
   * the view while actually playing, so this just needs to look good and never
   * fight with `player.update`.
   */
  private updateMenuCamera(ft: number) {
    this.menuYaw += ft * 0.05;
    const c = this.menuCenter;
    const R = CONFIG.map.half * 0.62;
    const cam = this.engine.camera;
    cam.position.set(
      c.x + Math.cos(this.menuYaw) * R,
      19 + Math.sin(this.menuYaw * 0.35) * 2.4, // gentle vertical drift
      c.z + Math.sin(this.menuYaw) * R
    );
    cam.lookAt(c.x, c.y + 1.5, c.z);
  }

  // ---------- loop ----------

  /** Menu footer: the current seed plus the mission + weather that seed rolled. */
  private updateSeedLabel() {
    const brief = this.mission.view(opScale().enemies, opScale().enemies);
    document.getElementById('seedLabel')!.textContent =
      `SEED ${this.map.seed} · ${t(brief.titleKey)} · ${t('wx.label')} ${t('weather.' + this.weather.kind)}`;
  }

  /** Compose the current time-of-day (day/night) with the per-seed moon mood
   *  and the active weather's fog, then push it onto the engine. Also dims
   *  map-level night glows (window panes, lanterns) through GeneratedMap. */
  private applyMoonlight() {
    const night = this.timeMode === 'night';
    const moon = night ? moonForSeed(this.map.seed) : null;
    applyDayNight(this.engine, this.timeMode, this.weather?.fogBase ?? null, moon);
    this.map.dayNight?.(!night);
    // recon coupling: hostiles see and shoot worse in the dark
    this.enemies.setNight(night);
  }

  /** Main-menu toggle: switch mood live (backdrop changes as you pick). */
  setTimeMode(mode: TimeMode) {
    this.timeMode = mode;
    saveTimeMode(mode);
    this.applyMoonlight();
    document.querySelectorAll<HTMLElement>('.timeBtn').forEach((b) =>
      b.classList.toggle('sel', b.dataset.t === mode)
    );
  }

  private onResize() {
    const { renderer, camera } = this.engine;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    const s = this.qualityCtrl.snapshot();
    renderer.setPixelRatio(s.pixelRatio * s.renderScale);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private fixedUpdate(dt: number) {
    this.map.dyn?.(dt); // scenery animation (banners etc.)
    this.updateFlares(dt);
    this.matchTime += dt;

    if (this.driving) {
      // tank driver: player body is parked inside the hull; drive + gun
      const mv = this.input.moveAxis();
      const mouse = this.input.consumeMouse();
      const fire = this.input.fireDown;
      this.driving.updatePlayer(
        dt,
        mv,
        mouse,
        fire,
        this.engine.camera,
        this.tankCamThird,
        this.player.sensMul
      );
      // keep the player's body glued to the tank so enemy fire can't hit a
      // "ghost" standing outside (he's inside armour — bullets tickle the hull)
      const tp = this.driving.pos;
      this.player.pos.set(tp.x, tp.y + 0.2, tp.z);
      // engine drone follows the throttle
      const maxV = this.driving instanceof Jeep ? CONFIG.jeep.maxSpeed : CONFIG.tank.maxSpeed;
      this.audio.setEnginePitch(Math.abs(this.driving.speed) / maxV);
      // off-road rattle: random mechanical clunks past walking pace
      if (Math.abs(this.driving.speed) > 3) {
        this.rattleCd -= dt;
        if (this.rattleCd <= 0) {
          this.rattleCd = 0.35 + Math.random() * 0.9;
          this.audio.playRattle();
        }
      } else {
        this.rattleCd = 0;
      }
      // hull HP drives the health bar while driving (armour readout)
      this.hud.setHealth(this.driving.hp, this.driving.maxHp);
      this.hud.setHealthLabel(t('hud.armor'));
      // jeep: the pintle MG belt takes over the ammo readout
      if (this.driving instanceof Jeep) {
        this.hud.setAmmo(this.driving.mgAmmo, 0, this.driving.mgReloadT > 0);
      }
      this.enemies.update(dt, this.player, this.damagePlayer);
      this.barrels.update(dt);
      this.map.destructibles.update(dt);
      this.physics.step();
      // enemy AI tank still hunts while we drive ours
      this.updateEnemyTank(dt);
      this.updateHudAndMission(dt, this.driving.pos);
      return;
    }

    this.player.update(dt, this.input, this.engine.camera);
    const fireClick = this.input.consumeFireClick();
    this.weapon.ads = this.input.adsToggle && !this.driving;
    this.weapon.update(dt, this.input.fireDown, fireClick, this.engine.camera);
    // ADS: zoom the FOV toward 75/zoom and soften the mouse while aiming
    const baseFov = 75;
    const targetFov = baseFov / (this.weapon.ads ? this.weapon.def.zoom : 1);
    const cam = this.engine.camera;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 12);
      cam.updateProjectionMatrix();
    }
    this.player.adsMul = this.weapon.ads ? 0.55 : 1;
    // sniper glass at 2x+: vignette + crosshair overlay
    this.hud.setScope(this.weapon.ads && (this.weapon.def.zoom ?? 1) >= 2);
    this.enemies.update(dt, this.player, this.damagePlayer);
    this.updateFireIndicators();
    this.barrels.update(dt);
    this.map.destructibles.update(dt);
    this.physics.step();
    this.updateEnemyTank(dt);
    this.updateHudAndMission(dt, this.player.pos);

    // near a driveable tank? surface the boarding hint (throttled)
    this.tankHintCd -= dt;
    if (this.playerTank?.alive && this.tankHintCd <= 0) {
      const tp = this.playerTank.pos;
      const d = Math.hypot(tp.x - this.player.pos.x, tp.z - this.player.pos.z);
      if (d < 4.5) {
        this.tankHintCd = 2;
        this.hud.showHint(t('tank.board'), 2.2);
      }
    }
  }

  /** Enemy tank AI (runs every fixed step in every mode except menus). */
  private updateEnemyTank(dt: number) {
    if (this.enemyTank?.alive) {
      this.enemyTank.updateAI(dt, this.player.pos, this.player.alive);
    }
  }

  /** The always-run HUD/mission/heat tail of fixedUpdate. */
  /** Throw a signal flare toward the crosshair (night tactics + atmosphere). */
  private throwFlare() {
    if (this.flareCd > 0 || this.driving || this.state !== 'playing') return;
    if (this.flares.length >= 2) return; // both pooled flares are in the air
    this.flareCd = 7;
    const eye = this.player.getEye();
    const dir = new THREE.Vector3();
    this.engine.camera.getWorldDirection(dir);
    this.flares.push({
      x: eye.x, y: eye.y, z: eye.z,
      vx: dir.x * 15, vy: 8.5, vz: dir.z * 15,
      t: 0, stage: 0, light: 0,
    });
    this.audio.playWeaponShot('shot_bolt'); // launch pop
  }

  /** Advance the flares and drive their pooled light/disc visuals. */
  private updateFlares(dt: number) {
    this.flareCd = Math.max(0, this.flareCd - dt);
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i];
      f.t += dt;
      if (f.stage === 0) {
        f.vy -= 13 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.z += f.vz * dt;
        f.light = Math.min(1, f.t / 0.5) * 34;
        if (f.vy < 0.5 && f.t > 0.45) {
          f.stage = 1;
          f.vy = -1.5;
          f.vx *= 0.25;
          f.vz *= 0.25;
        }
      } else if (f.stage === 1) {
        f.y += f.vy * dt;
        const gy = this.map.terrain.heightAt(f.x, f.z);
        f.light = 34 * Math.max(0, 1 - Math.max(0, f.t - 6) / 8);
        if (f.y < gy + 2 || f.t > 14) f.stage = 2;
      }
      if (f.stage === 2) this.flares.splice(i, 1);
    }
    for (let i = 0; i < this.flareLights.length; i++) {
      const L = this.flareLights[i];
      const D = this.flareDiscs[i];
      const f = this.flares[i];
      if (f) {
        L.position.set(f.x, f.y, f.z);
        L.intensity = f.light;
        D.position.set(f.x, f.y, f.z);
        D.lookAt(this.engine.camera.position);
        (D.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, f.light / 22);
      } else {
        L.intensity = 0;
        (D.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  }

  /** Battlefield soundscape: wind in calm spells, distant fire in battle. */
  private updateSoundscape(dt: number) {
    const battle = this.mood === 'battle';
    if (battle && this.windOn) {
      this.audio.stopWind();
      this.windOn = false;
    } else if (!battle && !this.windOn && !this.driving) {
      this.audio.startWind();
      this.windOn = true;
    }
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = battle ? 2.5 + Math.random() * 7 : 9 + Math.random() * 13;
      if (battle) {
        if (Math.random() < 0.55) this.audio.playDistantMG();
        else this.audio.playFarBoom();
      } else if (Math.random() < 0.5) {
        this.audio.playFarBoom();
      }
    }
    this.birdT -= dt;
    if (this.birdT <= 0) {
      this.birdT = 7 + Math.random() * 15;
      if (!battle && Math.random() < 0.75) this.audio.playBird();
    }
  }

  /** Pop a pre-allocated light at a muzzle position. */
  private flashMuzzle(pos: THREE.Vector3, radius: number, strength: number) {
    const l = this.muzzleLights[this.muzzleLi];
    this.muzzleLi = (this.muzzleLi + 1) % this.muzzleLights.length;
    l.position.copy(pos);
    l.distance = radius;
    l.intensity = strength;
  }

  // original fadeMuzzleLights removed — AtmosphereSystem owns it (A5)

  /**
   * Battlefield dynamics (C batch): while a fight drags on, the enemy camp
   * feeds bounded reinforcements in from beyond its own line; and once the
   * garrison is nearly broken the survivors sweep outward instead of
   * defending. A fast assault still wins before reinforcements arrive.
   */
  private updateBattleDynamics(dt: number, p: THREE.Vector3) {
    if (this.state !== 'playing') return;
    // PvP hunt: no AI forces — no despair charges, no reinforcements
    if (this.netPvp && this.net.state === 'ready') return;
    const camp = this.map?.camp;
    if (!camp) return;
    const sc = opScale();
    const alive = this.enemies.aliveCount();

    // despair charge (once): garrison survivors stop defending and sweep the
    // player's last known position — they come to find you
    if (!this.charged && this.matchTime > 40 && alive > 0 && alive <= sc.enemies * 0.3) {
      this.charged = true;
      this.enemies.alertAt(p.x, p.z, 1e9);
    }

    // reinforcements: only while hostiles are below the trigger fraction and
    // the (bounded) reserve pool is not yet empty
    if (
      this.reinLeft > 0 &&
      this.matchTime > CONFIG.reinforce.firstAt &&
      alive <= sc.enemies * CONFIG.reinforce.triggerFrac
    ) {
      this.reinTimer -= dt;
      if (this.reinTimer <= 0) {
        this.reinTimer = CONFIG.reinforce.every;
        const n = Math.min(CONFIG.reinforce.size, this.reinLeft);
        this.reinLeft -= n;
        // spawn out past the camp line (away from the player's base) — they
        // march in and defend, or hit the player's flank from behind
        const bx = camp.x - this.map.base.x;
        const bz = camp.z - this.map.base.z;
        const bl = Math.hypot(bx, bz) || 1;
        const ang0 = Math.atan2(bz, bx);
        for (let i = 0; i < n; i++) {
          const a = ang0 + (Math.random() - 0.5) * 1.2;
          const r = 30 + Math.random() * 30;
          const x = camp.x + Math.cos(a) * r;
          const z = camp.z + Math.sin(a) * r;
          this.enemies.spawnReinforce(
            new THREE.Vector3(x, this.map.terrain.heightAt(x, z) + 0.1, z)
          );
        }
        // keep the killfeed delta consistent after the squad grew
        this.lastAlive = this.enemies.aliveCount();
      }
    }
  }

  /**
   * The enemy flag changed hands ('capture' mission): recolor it, announce
   * it, and throw the garrison's reserve at the flag as a counterattack —
   * the rest of the fight is a defence.
   */
  private onCampCaptured() {
    const camp = this.map?.camp;
    if (!camp) return;
    this.map.flagMats.hostile.color.setHex(0x3f7a3a); // their red becomes our green
    this.hud.addKill(`<b>${t('flag.captured')}</b>`);
    this.audio.playVoice('v_cn_nice', 0.9);
    const n = Math.min(4, this.reinLeft);
    if (n > 0) {
      this.reinLeft -= n;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 15 + Math.random() * 10;
        const x = camp.x + Math.cos(a) * r;
        const z = camp.z + Math.sin(a) * r;
        this.enemies.spawnReinforce(
          new THREE.Vector3(x, this.map.terrain.heightAt(x, z) + 0.1, z)
        );
      }
      this.lastAlive = this.enemies.aliveCount();
    } else {
      // no reserve left — the surviving garrison sweeps the flag instead
      this.enemies.alertAt(camp.x, camp.z, 1e9);
    }
    this.hud.addKill(`<b>${t('flag.contest')}</b>`);
  }

  private updateHudAndMission(dt: number, p: THREE.Vector3) {
    if (this.dbg) {
      (window as unknown as Record<string, unknown>).__sfTick = {
        st: this.net.state, nm: this.netMode, t: Math.round(this.matchTime * 10) / 10,
      };
    }
    this.updateBattleDynamics(dt, p);
    this.updateSoundscape(dt);
    // night recon: the camp searchlight sweep exposes the player standing in
    // its beam — nearby hostiles turn toward the light and the HUD warns
    this.slCheckCd -= dt;
    if (this.slCheckCd <= 0 && this.timeMode === 'night' && this.map.searchlight) {
      this.slCheckCd = 0.4;
      const pp = this.player.pos;
      if (this.map.searchlight.isIlluminating(pp.x, pp.z)) {
        this.enemies.alertAt(pp.x, pp.z, 90);
        if (this.slWarnCd <= 0) {
          this.slWarnCd = 6;
          this.hud.showHint(t('tactic.searchlit'), 2.5);
          this.audio.playHit();
        }
      }
    }
    if (this.slWarnCd > 0) this.slWarnCd -= dt;

    // proximity F hints: rescue first, then resupply
    if (!this.driving) {
      const pp = this.player.pos;
      const downed = this.enemies.nearestDowned(pp.x, pp.z, 2.6);
      let near = -1;
      if (!downed) {
        this.map.ammoDumps.forEach((d, i) => {
          if (!this.resupplied.has(i) && Math.hypot(d.x - pp.x, d.z - pp.z) < 3) near = i;
        });
      }
      const hint = downed ? t('rescue.hint') : near >= 0 ? t('resupply.hint') : null;
      if (hint && !this.dumpHintOn) {
        this.dumpHintOn = true;
        this.hud.showHint(hint, 1.2);
      } else if (!hint && this.dumpHintOn) {
        this.dumpHintOn = false;
        this.hud.hideHint();
      }
    }

    // low-health squad call: once per drop below 30%, re-armed above 50%
    const hpPct = this.player.health / CONFIG.player.maxHealth;
    if (hpPct < 0.3 && !this.holdVoiced) {
      this.holdVoiced = true;
      this.audio.playVoice('v_cn_hold', 0.9);
    } else if (hpPct > 0.5) {
      this.holdVoiced = false;
    }
    // adaptive soundtrack: heat from recent combat, tension from proximity
    const nowS = performance.now() / 1000;
    const tenseRange = CONFIG.enemyClasses.reduce((m, c) => Math.max(m, c.sightRange), 0);
    let nearest = Infinity;
    for (const e of this.enemies.getEnemies()) {
      if (!e.alive) continue;
      const et = e.body.translation();
      const d = Math.hypot(et.x - p.x, et.z - p.z);
      if (d < nearest) nearest = d;
      if (nowS - e.lastShot < 2) this.heat = Math.max(this.heat, 0.95);
    }
    this.heat = Math.max(0, this.heat - dt / 6);
    const target: Mood =
      this.heat > 0.2 ? 'battle' : nearest < tenseRange ? 'tense' : 'calm';
    if (target !== this.mood) {
      this.mood = target;
      this.music.setMood(target);
    }

    // kill-feed delta (hostiles only — squad mates don't advance the mission)
    // PvP hunt: no AI squads exist — the co-op counters stay untouched there
    const pvpActive = this.netPvp && this.net.state === 'ready';
    const alive = this.enemies.aliveCount();
    if (!pvpActive) {
      if (alive < this.lastAlive) {
        const killed = this.lastAlive - alive;
        this.kills += killed;
        this.hud.addKill(`<b>${killed}</b> ${t('kill.down')}`);
        this.lastAlive = alive;
        this.checkStreak();
      }
      this.hud.setEnemies(alive);

      // friendly squad status: a colour-coded counter + a killfeed note when a
      // squadmate falls (squad losses never fail the operation)
      const sqAlive = this.enemies.alliesAlive();
      const sqTotal = opScale().allies;
      if (sqAlive < this.lastSquadAlive) {
        const lost = this.lastSquadAlive - sqAlive;
        this.hud.addKill(`<b>${lost}</b> ${t('hud.allyDown')}`);
        // squad wiped (or nearly): the Chinese squad voice calls to hold
        if (sqAlive === 0 && !this.losingVoiced && sqTotal > 0) {
          this.losingVoiced = true;
          this.audio.playVoice('v_losing', 0.8);
        }
      }
      if (sqAlive > this.lastSquadAlive) this.losingVoiced = false; // reinforced
      this.lastSquadAlive = sqAlive;
      this.hud.setSquad(sqAlive, sqTotal);
    }    // voice cooldowns tick here (same cadence as the HUD update)
    if (this.tangoCd > 0) this.tangoCd -= dt;
    if (this.allyVoiceCd > 0) this.allyVoiceCd -= dt;

    // --- netplay sync ---
    if (this.netMode === 'host' && this.net.state === 'ready' && this.remotePlayer) {
      // remote ghost movement + AI targeting the remote body
      this.remotePlayer.update(dt, this.map.terrain);
      this.enemies.setRemoteTarget(this.remotePlayer);
      // 20Hz world snapshot
      this.netSnapT += dt;
      if (this.netSnapT >= 0.05) {
        this.netSnapT = 0;
        const enemies: SnapshotEnemy[] = [];
        this.enemies.getEnemies().forEach((e, i) => {
          if (!e.alive) return;
          const ep = e.pos();
          const hp = Math.max(0, Math.round((e as unknown as { health: number }).health));
          enemies.push({ id: i, x: ep.x, z: ep.z, yaw: 0, hp, flags: 0 });
        });
        const allies: SnapshotAlly[] = this.enemies.getAlliesSnapshot();
        const w = window as unknown as Record<string, number>;
        w.__sfSent = (w.__sfSent ?? 0) + 1;
        this.net.sendSnapshot(
          encodeSnapshot(this.snapTick++ & 0xffff, this.player.health, this.player.pos.x, this.player.pos.y, this.player.pos.z, enemies, allies)
        );
      }
    }
    // --- PvP hunt tick ---
    if (this.netPvp && this.net.state === 'ready') {
      this.pvpTimeLeft -= dt;
      if (this.pvpTimeLeft <= 0) {
        // time's up: higher score wins (host authoritative, ties favour host)
        this.gameOver(this.pvpScoreSelf >= this.pvpScoreFoe);
      }
      // host respawn countdown
      if (this.pvpRespawnT > 0) {
        this.pvpRespawnT -= dt;
        if (this.pvpRespawnT <= 0) {
          const sp = this.map.allySpawns[(Math.random() * this.map.allySpawns.length) | 0] ?? new THREE.Vector3(this.map.base.x, 0.1, this.map.base.z);
          this.player.respawnAt(sp.x, sp.z);
          this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
          this.net.sendEvent(NET_EVENTS.RESPAWN, new Uint8Array([1]).buffer);
        }
      }
      // host wins when the foe is down 15 — score broadcast on every change
      if (this.pvpScoreSelf >= 15) this.gameOver(true);
      else if (this.pvpScoreFoe >= 15) this.gameOver(false);
    }
    // PvP hunt: the tick above owns win/lose — the co-op mission must NEVER
    // run here (aliveCount is 0 by design, which read as an instant victory)
    if (pvpActive) return;

    if (this.netMode === 'client' && this.net.state === 'ready') {
      // 30Hz input upload
      this.netInputT += dt;
      if (this.netInputT >= 0.033) {
        this.netInputT = 0;
        const ax = this.input.moveAxis();
        const btn =
          (this.input.fireDown ? BTN.FIRE : 0) |
          (this.input.adsToggle ? BTN.ADS : 0) |
          (this.input.crouchHeld ? BTN.CROUCH : 0) |
          (this.input.consumeProneToggle() ? BTN.PRONE : 0);
        this.net.sendInput(btn, this.player.yaw, this.player.pitch, ax.x, ax.z);
      }
      this.ghostSwarm?.update(dt);
      // client HUD: counters read the SNAPSHOT ghosts (the local manager is
      // empty by design — reading it showed 敌人剩余 0 / 小队 0 forever)
      const swarm = this.ghostSwarm;
      if (swarm) {
        const ghostN = swarm.enemyAliveCount();
        this.hud.setEnemies(ghostN);
        this.hud.setSquad(swarm.allyAliveCount(), opScale().allies);
        // same objective view as the host: killed/total from the shared seed
        this.hud.setObjective(this.mission.view(ghostN, opScale().enemies));
      }
      const pp = this.player.pos;
      const canRescue = this.ghostSwarm?.downedAllyNear(pp.x, pp.z, 2.6) ?? false;
      const canSupply = this.map.ammoDumps.some((d) => Math.hypot(d.x - pp.x, d.z - pp.z) < 3);
      const hint = canRescue ? t('rescue.hint') : canSupply ? t('resupply.hint') : null;
      if (hint && !this.dumpHintOn) {
        this.dumpHintOn = true;
        this.hud.showHint(hint, 1.2);
      } else if (!hint && this.dumpHintOn) {
        this.dumpHintOn = false;
        this.hud.hideHint();
      }
      // client respawn countdown (PvP hunt)
      if (this.pvpRespawnT > 0) {
        this.pvpRespawnT -= dt;
        if (this.pvpRespawnT <= 0) {
          const sp = this.map.allySpawns[(Math.random() * this.map.allySpawns.length) | 0] ?? new THREE.Vector3(this.map.base.x, 0.1, this.map.base.z);
          this.player.respawnAt(sp.x, sp.z);
          this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
        }
      }
      // client skips local AI/mission — the host decides everything
      return;
    }

    // mission objective: from here on, win/lose is driven by the mission
    const res = this.mission.update(dt, p, alive, opScale().enemies);
    this.hud.setObjective(this.mission.view(alive, opScale().enemies));
    if (res === 'win') this.gameOver(true);
    else if (res === 'lose') {
      this.timedOut = true;
      this.gameOver(false);
    }
  }

  private loop = (now: number) => {
    // Schedule the next frame FIRST, so a thrown error anywhere below can NEVER
    // stop the render loop (a hard "frozen" page). We catch, surface the error,
    // and keep ticking instead of silently dying.
    if (!this.externalLoop) requestAnimationFrame(this.loop);
    try {
    // Clamp the frame delta so one stalled frame can never seed a backlog.
    const ft = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;

    if (this.state === 'playing') {
      this.acc += ft;
      // Cap the accumulator at the work we can do this frame. If we hit the
      // ceiling we drop the remainder rather than carry it forward — this is
      // the spiral-of-death breaker: a slow frame costs at most MAX_SUBSTEPS
      // physics steps, so the page stays responsive no matter how loaded it gets.
      const maxAcc = DT * MAX_SUBSTEPS;
      if (this.acc > maxAcc) this.acc = maxAcc;
      let steps = 0;
      while (this.acc >= DT && steps < MAX_SUBSTEPS) {
        this.fixedUpdate(DT);
        this.acc -= DT;
        steps++;
      }
      if (steps >= MAX_SUBSTEPS) this.acc = 0; // maxed out — don't hoard time
    }

    this.hostGameplayFrame(ft);
    this.hostEffectsFrame(ft);
    this.hostAtmosphereFrame(ft, this.state === 'playing');
    if (this.state === 'playing') {
      this.hostQualityAuto(ft);
    }
    this.hostPresent(ft);
    } catch (err) {
      this.reportLoopError(err);
    }
  };

  /** Weapon/minimap targeting: ghosts in client mode, local squad otherwise. */
  private enemyTargets() {
    return this.netMode === 'client' && this.ghostSwarm
      ? this.ghostSwarm.combatTargets()
      : this.enemies.getEnemies();
  }

  /** Netplay event router: host settles client requests; client renders host truth. */
  private onNetEvent(sub: number, args: DataView) {
    if (this.netMode === 'host') {
      // client respawned → its ghost is whole again
      if (sub === NET_EVENTS.RESPAWN && this.remotePlayer) {
        this.remotePlayer.hp = 100;
        return;
      }
      // PvP: the client shot US (target 1 = host body) → settle locally
      if (sub === NET_EVENTS.HIT && args.byteLength >= 2 && args.getUint8(0) === 1) {
        this.damagePlayer(args.getUint8(1));
        return;
      }
      // INTERACT from the client: kind 0 = rescue, 1 = supply
      if (sub === NET_EVENTS.INTERACT) {
        const kind = args.getUint8(0);
        const rp = this.remotePlayer;
        if (!rp) return;
        const rpPos = rp.pos();
        if (kind === 0) {
          const downed = this.enemies.nearestDowned(rpPos.x, rpPos.z, 2.6);
          if (downed) {
            downed.revive();
            this.net.sendEvent(NET_EVENTS.RESC, new ArrayBuffer(0));
            this.hud.addKill(`<b>${t('rescue.done')}</b>`);
          }
        } else if (kind === 1) {
          const dump = this.map.ammoDumps.findIndex(
            (d, i) => !this.resupplied.has(i) && Math.hypot(d.x - rpPos.x, d.z - rpPos.z) < 3
          );
          if (dump >= 0) {
            this.resupplied.add(dump);
            this.net.sendEvent(NET_EVENTS.MEDKIT, new ArrayBuffer(1));
          }
        }
      }
      return;
    }
    // CLIENT: render the host's truth
    if (sub === NET_EVENTS.SHOT) {
      // args: muzzle f32x3 + dir f32x3 — remote gunfire visual
      const mx = args.getFloat32(0);
      const my = args.getFloat32(4);
      const mz = args.getFloat32(8);
      const dx = args.getFloat32(12);
      const dy = args.getFloat32(16);
      const dz = args.getFloat32(20);
      const muzzle = new THREE.Vector3(mx, my, mz);
      const end = muzzle.clone().addScaledVector(new THREE.Vector3(dx, dy, dz).normalize(), 60);
      this.effects.tracer(muzzle, end);
      this.effects.muzzle(muzzle);
      this.audio.playJeepMG();
    } else if (sub === NET_EVENTS.HIT) {
      // host settled damage against THIS client (target 0 = self)
      if (args.getUint8(0) === 0) {
        const dmg = args.getUint8(1);
        if (dmg > 0) {
          this.player.damage(dmg);
          this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
          this.hud.flashDamage();
          if (this.player.health <= 0 && this.netPvp) {
            // hunt death: 3s respawn handled by the local tick
            this.pvpRespawnT = 3;
          }
        }
      }
    } else if (sub === NET_EVENTS.SCORE) {
      // host broadcasts {host, client} — flip for the client's point of view
      this.hud.setPvpScore(args.getUint8(1), args.getUint8(0));
    } else if (sub === NET_EVENTS.RESC) {
      this.hud.showHint(t('rescue.done'), 2.5);
    } else if (sub === NET_EVENTS.MISSION) {
      // host decided the outcome: 1 = win, 0 = loss
      this.gameOver(args.getUint8(0) === 1);
    } else if (sub === NET_EVENTS.MEDKIT) {
      this.weapon.refillAllReserves();
      this.hud.showHint(t('resupply.done'), 2.5);
    } else if (sub === NET_EVENTS.RESPAWN) {
      // host respawned — clear its downed state on our scoreboard view
      if (this.netPvp && args.byteLength >= 1) {
        const who = args.getUint8(0);
        void who; // 1 = host; its ghost hp resets via the next snapshot
      }
    }
  }

  /** M: show / hide the full-screen tactical map (whole battlefield view). */
  private toggleFullMap() {
    if (this.state !== 'playing') return;
    this.fullmapOpen = !this.fullmapOpen;
    document.getElementById('fullmap')?.classList.toggle('hidden', !this.fullmapOpen);
  }

  // updateDiagnostics / fpsElT moved to RenderPresentSystem (A3)

  /** Surface a loop exception as an on-screen banner instead of a silent freeze. */
  private reportLoopError(err: unknown) {
    console.error('[loop]', err);
    if (this.errEl) {
      this.errEl.style.display = 'block';
      this.errEl.textContent =
        'Render error (loop kept alive): ' +
        (err instanceof Error ? err.message + '\n' + (err.stack || '') : String(err));
    }
  }
}
