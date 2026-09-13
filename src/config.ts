// 夜袭 / Night Raid — central tunables.
// Everything gameplay-affecting lives here so the content layer can be tweaked
// without touching systems code. (Matches the "keep framework, replace content" rule.)

export const CONFIG = {
  world: {
    gravity: -22, // m/s^2, a touch heavier than Earth for snappy FPS feel
    groundSize: 200, // half-extent of the playfield (meters)
    fixedDt: 1 / 60, // physics timestep
  },
  player: {
    radius: 0.35,
    height: 1.7, // total capsule height
    eyeHeight: 1.55,
    moveSpeed: 6.5,
    sprintMul: 1.7,
    jumpSpeed: 8.5,
    maxHealth: 100,
    mouseSensitivity: 0.0022,
    fov: 75,
  },
  // Player arsenal. Slots 1-4; scroll wheel cycles. auto=false requires a
  // fresh click per shot. sound = audio bank key; vm = viewmodel box size.
  weapons: [
    {
      key: 'rifle',
      zoom: 1.25,
      damage: 26,
      fireRate: 8, // rounds per second
      magSize: 30,
      reserve: 90,
      reloadTime: 1.8,
      range: 120,
      spread: 0.012, // radians
      recoil: 0.018,
      auto: true,
      sound: 'shot_rifle',
    },
    {
      key: 'smg',
      zoom: 1.1,
      damage: 15,
      fireRate: 14,
      magSize: 45,
      reserve: 135,
      reloadTime: 2.2,
      range: 90,
      spread: 0.03,
      recoil: 0.011,
      auto: true,
      sound: 'shot_smg',
    },
    {
      key: 'carbine',
      zoom: 1.2,
      damage: 20,
      fireRate: 11,
      magSize: 25,
      reserve: 100,
      reloadTime: 1.5,
      range: 110,
      spread: 0.02,
      recoil: 0.014,
      auto: true,
      sound: 'shot_carbine',
    },
    {
      key: 'bolt',
      zoom: 2.5,
      damage: 75,
      fireRate: 1.25,
      magSize: 5,
      reserve: 40,
      reloadTime: 3.0,
      range: 160,
      spread: 0.004,
      recoil: 0.055,
      auto: false,
      sound: 'shot_bolt',
    },
    {
      key: 'lmg',
      damage: 18,
      fireRate: 12,
      magSize: 75,
      reserve: 150,
      reloadTime: 3.6,
      range: 110,
      spread: 0.038,
      recoil: 0.016,
      auto: true,
      zoom: 1.15,
      sound: 'shot_rifle',
    },
    {
      key: 'shotgun',
      damage: 55,
      fireRate: 1.1,
      magSize: 6,
      reserve: 36,
      reloadTime: 2.6,
      range: 26,
      spread: 0.07,
      recoil: 0.05,
      auto: false,
      zoom: 1.0,
      sound: 'shot_carbine',
    },
  ],
  // Battlefield scale presets — picked on the main menu before each operation.
  scale: {
    patrol: { enemies: 6, allies: 3, dmgMul: 0.8, hpMul: 0.9, reserve: 0 }, // small squad skirmish
    standard: { enemies: 12, allies: 8, dmgMul: 1, hpMul: 1, reserve: 4 }, // two-base assault
    grand: { enemies: 32, allies: 24, dmgMul: 1.1, hpMul: 1.15, reserve: 10 }, // full battle — three-pronged push with 24-strong friendly company
  } as Record<ScaleKey, ScaleDef>,
  // Battlefield dynamics (C batch): bounded enemy reinforcements that march
  // in from beyond the camp while the fight drags on — a slow assault never
  // lets the map go quiet, but a fast one still wins before they arrive.
  reinforce: {
    firstAt: 60, // seconds before the first reinforcement check
    every: 45, // seconds between checks while the trigger stays true
    size: 2, // soldiers per wave
    triggerFrac: 0.55, // check fires while fewer than this fraction are alive
  },
  enemy: {
    count: 7, // hostile soldiers (spawn clustered at their base camp)
    radius: 0.35,
    height: 1.7,
    aimTime: 0.7, // marksman laser-aim beat before the shot (visible warning)
  },
  // Friendly rifle squad that deploys beside the player each operation.
  ally: {
    count: 3,
    followDist: 9, // preferred standoff distance while trailing the player
    followRange: 38, // allies engage hostiles inside this radius of the player
    color: 0x4a7a4a, // uniform tint for the friendly squad
  },
  // Enemy archetypes. EnemyManager builds a mixed squad each operation.
  enemyClasses: [
    {
      key: 'rifle', // standard infantry
      maxHealth: 70,
      moveSpeed: 3.2,
      sightRange: 45,
      fireRange: 35,
      fireRate: 1.4,
      damage: 9,
      aimError: 0.06,
      color: 0xc0392b,
      gunLen: 0.5,
      snd: 'rifle' as const,
    },
    {
      key: 'smg', // fast rusher, shreds up close
      maxHealth: 55,
      moveSpeed: 4.3,
      sightRange: 30,
      fireRange: 20,
      fireRate: 3.5,
      damage: 5,
      aimError: 0.09,
      color: 0xc07a30,
      gunLen: 0.35,
      snd: 'smg' as const,
    },
    {
      key: 'marksman', // slow, long reach; fires only after a visible laser aim
      maxHealth: 50,
      moveSpeed: 2.3,
      sightRange: 60,
      fireRange: 55,
      fireRate: 0.42,
      damage: 15,
      aimError: 0.035,
      color: 0xd04848,
      gunLen: 0.7,
      snd: 'sniper' as const,
    },
    {
      key: 'rpg', // slow rocket specialist — visible rocket, splash damage
      maxHealth: 90,
      moveSpeed: 2.0,
      sightRange: 55,
      fireRange: 48,
      fireRate: 0.14, // one rocket every ~7s while engaged
      damage: 85, // splash at the impact point
      aimError: 0.09, // rockets are dodgeable
      color: 0x7d5a3c,
      gunLen: 0.8,
      snd: 'rifle' as const,
    },
    {
      key: 'lmg', // suppression specialist — long bursts, walks while firing
      maxHealth: 85,
      moveSpeed: 2.6,
      sightRange: 50,
      fireRange: 38,
      fireRate: 6,
      damage: 6,
      aimError: 0.085,
      color: 0x8a6d3b,
      gunLen: 0.65,
      snd: 'rifle' as const,
    },
  ],
  map: {
    half: 110, // CORE combat radius — bases, tanks, missions & minimap live here
    contentHalf: 150, // scenery scatter radius — props/fires/hulks spread this far
    terrainHalf: 320, // terrain radius — wall-less open world extends far beyond content
    borderH: 3, // (legacy: border walls removed, kept for compat)
    crates: 60, // crate clusters (1-3 stacked)
    walls: 24, // lone wall segments
    compounds: 9, // L/U-shaped courtyard ruins
    rings: 12, // sandbag rings
    rocks: 18, // rocks
    trees: 16, // dead trees (silhouette + trunk collider)
    wrecks: 5, // burnt-out vehicle husks (cover)
    barricades: 7, // hedgehog anti-tank barriers (scenery)
    craters: 18, // scorched shell craters (decal, scenery)
    towers: 2, // watchtowers with a warm lamp (scenery + one static light)
    hamlets: 3, // ruined-building clusters in the outer band (skyline + cover)
    tanks: 3, // abandoned MBT hulks — low-slung hard cover
    bunkers: 2, // concrete pillbox domes (hard cover with a slit)
    concertinas: 2, // razor-wire coil rows (low barriers)
    planes: 2, // crashed aircraft wrecks (scenery + a smoke column)
    jeeps: 2, // abandoned scout jeeps (small cover, near tanks/hamlets)
    trucks: 2, // abandoned cargo trucks (canvas or open flatbed)
    tankers: 1, // abandoned fuel tankers (long cylinder silhouette)
    fences: 5, // barbed-wire fence rows (visual, posts have thin colliders)
    mgNests: 2, // sandbag machine-gun nests (scenery — tripod MG, no shooter)
    hedgehogs: 5, // anti-tank hedgehogs (crossed steel beams, blocking cover)
    ruinWalls: 3, // broken wall stubs with rebar (rubble cover near hamlets)
    poles: 4, // utility poles with sagging wire stubs (night silhouettes)
    ammoDumps: 2, // crate + belt-box stacks (small landmarks)
    signposts: 3, // wooden signposts (ambient waymarks)
    minGap: 4.5, // min spacing between obstacle footprints
    spawnClear: 10, // clear radius around the PLAYER BASE (props stay out)
    enemyRing: [40, 75] as [number, number], // scenery ring band (hamlets etc.)
    // Dual-end deployment: the player's base sits on one side of a random axis
    // (baseRing × half), the hostile camp diametrically opposite (campRing ×
    // half) — ~125-155m apart with open middle ground the two sides meet on.
    baseRing: [0.52, 0.6] as [number, number], // player base radius as a fraction of half
    campRing: [0.62, 0.82] as [number, number], // hostile camp radius (opposite the base)
    campFootprint: 15, // claimed radius so nothing else spawns inside the camp
    flagH: 3.2, // camp flag pole height
  },
  // Rolling night terrain. One seeded heightfield drives the render mesh, the
  // physics trimesh (same buffers) and prop placement, so they can never drift.
  terrain: {
    segments: 168, // grid cells per side (168^2*2 ≈ 56k tris across the open world)
    amplitude: 2.2, // peak height in meters
    noiseScale: 0.022, // spatial frequency of the base octave
    octaves: 4, // fbm detail layers
    flatRadius: 11, // level pocket kept around the player spawn
  },
  // Mission objectives layered on top of "kill everything" (seeded per map).
  mission: {
    assaultTime: 150, // seconds for the timed assault variant
    exfilRadius: 3.5, // stand inside this to complete an exfiltration
    exfilMinDist: 45, // exfil zone stays at least this far from the spawn
  },
  // Destructible wooden crates — chipped by bullets, shatter into debris.
  destructible: {
    hp: 18, // ~2 rifle bursts or a burst from the SMG
    fragments: 4, // debris chunks spawned on shatter
    fragLife: 6, // seconds before debris fades away
  },
  // Weather: seeded per operation. Varies fog density; rain/storm add a wind-
  // driven rain field. (Drop counts only; behaviour lives in src/world/weather.ts)
  weather: {
    rain: 1200, // drops for a normal rain front
    rainStorm: 2600, // heavier for a storm
  },
  // Ambient battlefield fires (campfires / brush blazes). Purely cosmetic
  // scenery with a flickering pooled light each. Kept few and static so the
  // scene's light count never changes mid-fight (a light added per-frame is
  // what used to force a THREE material recompile and freeze the page).
  fires: {
    count: 5, // campfire / blaze sites scattered around the arena
    bigChance: 0.35, // chance a site is a tall brush blaze instead of a low campfire
    lightDist: 15, // point-light range
    lightBase: 30, // mean intensity (flickers ±~40%)
  },
  // Explosible fuel drums. hp is tuned so a rifle burst or one bolt shot sets
  // them off; the blast damages player AND enemies, and can chain-detonate.
  barrel: {
    count: 8,
    hp: 30,
    radius: 0.42,
    height: 1.1,
    blastRadius: 9,
    blastDamage: 80,
    edgeFrac: 0.15, // damage multiplier at the blast edge
    impulse: 5,
    fuseMin: 0.12, // chain-reaction fuse range (s)
    fuseMax: 0.4,
  },
  // Armoured vehicles: one player-driveable tank + one enemy AI tank per map.
  // Movement is a rigid Rapier body with a cylindrical collider (the body is
  // rotation-locked — we yaw the mesh instead), so it can never flip over.
  tank: {
    hp: 1800, // player tank
    enemyHp: 2400, // AI tank (slightly tougher)
    maxSpeed: 8.5,
    maxRev: -3.5,
    accel: 6,
    brake: 10,
    turnRate: 1.1, // rad/s while moving
    colliderR: 1.6, // collision cylinder radius
    colliderHalfH: 0.75, // half-height of the collision cylinder
    shellSpeed: 85,
    shellRange: 320,
    shellDamage: 240,
    shellRadius: 9,
    shellEdge: 0.12,
    reload: 3.5, // s between main-gun shots
    turretRate: 1.6, // turret traverse rad/s
    gunPitchMin: -0.1,
    gunPitchMax: 0.3,
    bulletArmor: 0.04, // small-arms damage factor against the hull
    driveTime: 7, // enemy tank idle before it starts hunting
  },
  jeep: {
    hp: 70,
    maxSpeed: 15,
    maxRev: -6,
    accel: 11,
    turnRate: 2.3, // rad/s — nimble compared to the MBT
    colliderR: 1.15,
    colliderHalfH: 0.7,
  },
  colors: {
    sky: 0x0d1524,
    fog: 0x0d1524,
    ground: 0x262d24,
    enemyDead: 0x5a2a22,
    tracer: 0xfff2a8,
    muzzle: 0xffd27f,
  },
} as const;

export type Config = typeof CONFIG;
export type WeaponDef = typeof CONFIG.weapons[number];
export type EnemyClassDef = typeof CONFIG.enemyClasses[number];
export type ScaleKey = 'patrol' | 'standard' | 'grand';
export interface ScaleDef {
  enemies: number;
  allies: number;
  dmgMul: number; // hostile damage multiplier
  hpMul: number; // hostile health multiplier
  reserve: number; // extra hostiles that may reinforce later (0 = never)
}
