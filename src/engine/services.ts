/** Engine service locator — filled at boot, read-only to systems. */
import type { PhysicsWorld } from '../physics/world';
import type { Input } from './input';
import type { AssetHub } from './assets/AssetHub';
import type { AudioEngine } from './audio/AudioEngine';
import type { RendererFacade } from './render/RendererFacade';
import type { QualityController } from './quality/QualityController';

export interface EngineServices {
  renderer: RendererFacade;
  physics: PhysicsWorld;
  assets: AssetHub;
  audio: AudioEngine;
  input: Input;
  quality: QualityController;
  events: Emitter;
}

export type EventHandler = (payload?: unknown) => void;

/** Tiny sync emitter for cross-system signals (mission win, damage, etc.). */
export class Emitter {
  private map = new Map<string, Set<EventHandler>>();

  on(evt: string, fn: EventHandler): () => void {
    let set = this.map.get(evt);
    if (!set) this.map.set(evt, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  off(evt: string, fn: EventHandler): void {
    this.map.get(evt)?.delete(fn);
  }

  emit(evt: string, payload?: unknown): void {
    const set = this.map.get(evt);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] ${evt}`, err);
      }
    }
  }

  clear(): void {
    this.map.clear();
  }
}

/** Well-known event names used by the Night Raid sample. */
export const EV = {
  PlayerDamaged: 'player.damaged',
  PlayerDied: 'player.died',
  EnemyKilled: 'enemy.killed',
  MissionEnd: 'mission.end',
  NetEvent: 'net.event',
} as const;
