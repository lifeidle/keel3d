/**
 * keel3d public library entry — framework surface for npm consumers.
 * Do not import sample content (src/game/*) from here.
 */

// L3 contract
export {
  defineGame,
  type DefinedGame,
  type BaseRecipeOpts,
} from './content/defineGame';
export type {
  GameSpec,
  GameCreateContext,
  GameInstance,
  MapSpec,
  FixedMapDef,
  UnitDef,
  CameraSpec,
  CameraMode,
} from './content/define';
export { mountSampleGame, type MountSampleOptions, type MountedSample } from './content/host';

// Engine types (host-owned loop)
export type { System, EngineWorld, EngineHost, GameModule } from './engine/types';

// Host bootstrap — 仓库外项目用它起引擎，不必自己接线（与仓库内 main.ts 同一条路径）
export {
  createHost,
  bootGame,
  type Host,
  type BootedGame,
  type BootOptions,
  type BootDom,
} from './content/boot';

// Engine / quality 原语（需要自定义宿主时使用）
export { Engine } from './engine/Engine';
export { createEngineAsync, WebGpuRequiredError } from './engine/renderer';
export { QualityController } from './engine/quality/QualityController';
export { detectQuality } from './world/quality';
export { initI18n, t } from './i18n';

// Core L2 blocks (stable surface)
export { Pool } from './blocks/Pool';
export { Path, type PathPoint } from './blocks/Path';
export * as Steering from './blocks/Steering';
export { CameraRig, type CameraMode as RigCameraMode } from './blocks/CameraRig';
export { createUnitBody, type UnitBodyOpts, type UnitBody } from './blocks/Unit';
export { ChunkWorld, type ChunkWorldOpts } from './blocks/ChunkWorld';
export { GridAStar } from './blocks/GridAStar';
export { buildMap } from './blocks/MapBuilder';

// Gameplay
export { Health } from './blocks/gameplay/Health';
export { Economy } from './blocks/gameplay/Economy';
export { Scoreboard } from './blocks/gameplay/Scoreboard';
export { WaveDirector, type WaveDef } from './blocks/gameplay/WaveDirector';
export { PlaceGrid } from './blocks/gameplay/PlaceGrid';
export { Spawner } from './blocks/gameplay/Spawner';
export { Timers } from './blocks/gameplay/Timers';
export { Streak, type StreakOpts } from './blocks/gameplay/Streak';
export { LootTable, type LootEntry, type ItemStack } from './blocks/gameplay/LootTable';
export { Inventory, type InvItem } from './blocks/gameplay/Inventory';
export { FactionMap } from './blocks/gameplay/Faction';
export { Dialogue, type DialogueNode } from './blocks/gameplay/Dialogue';

// Combat
export { Cooldown } from './blocks/combat/Cooldown';
export { Magazine } from './blocks/combat/Magazine';
export { Arsenal, type ArsenalSlotDef, type FireOutcome } from './blocks/combat/Arsenal';
export { pickTarget } from './blocks/combat/Targeting';
export { Projectile, stepProjectiles } from './blocks/combat/Projectile';
export { areaHits, ringHits } from './blocks/combat/AreaDamage';
export {
  blastHits,
  DEFAULT_BLAST,
  type BlastTarget,
  type BlastConfig,
  type BlastHit,
} from './blocks/combat/Blast';
export {
  ArcProjectile,
  arcVelocityToward,
  type ArcOpts,
} from './blocks/combat/ArcProjectile';

// Progress
export {
  SaveSlot,
  BestScoreSlot,
  memoryStore,
  type SaveStore,
  type SaveSlotOpts,
} from './blocks/progress/SaveSlot';
export { LevelTable } from './blocks/progress/LevelTable';
export { RunState } from './blocks/progress/RunState';
export { XpProgress } from './blocks/progress/XpProgress';
export { SkillTree } from './blocks/progress/SkillTree';

// Interact
export { TriggerZone } from './blocks/interact/TriggerZone';
export { Pickup, PickupField } from './blocks/interact/Pickup';
export { Interactable } from './blocks/interact/Interactable';

// Player / input / AI
export { CharacterController, computeMoveIntent, type CharInput } from './blocks/player/CharacterController';
export { Gamepad } from './blocks/input/Gamepad';
export {
  TouchControls,
  isTouchDevice,
  type TouchLookSink,
  type ActionButtonDef,
  type TouchControlsOptions,
} from './blocks/input/TouchControls';
export { canSee } from './blocks/ai/VisionCone';
export { NoiseEmitter } from './blocks/ai/NoiseEmitter';

// UI
export { HudPanel } from './blocks/ui/HudPanel';
export { HealthBar } from './blocks/ui/HealthBar';
export { EndOverlay } from './blocks/ui/EndOverlay';
export { Toast } from './blocks/ui/Toast';
export { DamageNumbers } from './blocks/ui/DamageNumber';
export { WorldBar } from './blocks/ui/WorldBar';
export { MinimapDots } from './blocks/ui/MinimapDots';
export { InventoryGrid } from './blocks/ui/InventoryGrid';
export { DialogBox } from './blocks/ui/DialogBox';
export { ButtonBar } from './blocks/ui/ButtonBar';
export { QuestTracker } from './blocks/ui/QuestTracker';
export { TacticalMap } from './blocks/ui/TacticalMap';
export { PauseMenu, type PauseMenuOptions } from './blocks/ui/PauseMenu';
export { ControlsOverlay, type ControlHint } from './blocks/ui/ControlsOverlay';

// Audio
export { KitSfx } from './blocks/audio/KitSfx';
export {
  duckGain,
  distanceGain,
  eventGain,
  DEFAULT_AUDIO_DUCK,
  type AudioDuckCfg,
} from './blocks/audio/AudioDuck';
export { BgmLayers } from './blocks/audio/BgmLayers';
export { SfxPlayer } from './blocks/audio/SfxPlayer';
export { BeatClock } from './blocks/audio/BeatClock';

// World / scene / fx
export { generateDungeon, isDungeonConnected, type DungeonLayout } from './blocks/world/ProcDungeon';
export { VoxelChunk } from './blocks/world/VoxelChunk';
export { SCALES, setScale, opScale, loadScale, type OpScale, type ScaleKey } from './world/scale';
export {
  placeTankHulk,
  placeScoutWreck,
  placePlaneWreck,
  placeFenceRow,
  placeMgNest,
  placeTruck,
  placeOilTanker,
  placeBunker,
  placeConcertina,
  placeHedgehog,
  placeRuinWall,
  placeUtilityPole,
  placeAmmoDump,
  placeSignpost,
  type HulkPhysics,
  type HulkTerrain,
  type PropHandles,
} from './blocks/props/VehicleHulk';
export { ShrinkZone } from './blocks/gameplay/ShrinkZone';
export { createSeededTerrain } from './blocks/scene/TerrainBuilder';
export { applyDaylight, addSunDisc } from './blocks/scene/Daylight';
export { Weather, pickWeather, moonForSeed, type WeatherKind } from './blocks/scene/Weather';
export { projectToScreen, type CamLike, type ScreenPoint, type V3Like } from './blocks/math/Projection';
export { ViewmodelSlots, damp, DEFAULT_BOB, type BobConfig } from './blocks/player/ViewmodelSlots';
export { kitSoldier, type SoldierRig, type SoldierPalette } from './blocks/kit/Soldier';
export { kitGun, type KitGun, type KitGunOpts } from './blocks/kit/Gun';
export { fabricTexture } from './blocks/kit/textures';
export { ClothFlags, type TerrainLike } from './blocks/props/ClothFlags';
export { Searchlight } from './blocks/props/Searchlight';

export const VERSION = '0.3.0';
export const BRAND = 'KeeL 3D';
