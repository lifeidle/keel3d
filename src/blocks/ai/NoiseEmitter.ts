/**
 * NoiseEmitter — radius events to registered listeners. Pure logic.
 */
export interface NoiseEvent {
  x: number;
  z: number;
  radius: number;
  tag?: string;
}

export type NoiseListener = (e: NoiseEvent) => void;

export class NoiseEmitter {
  private listeners: NoiseListener[] = [];

  on(fn: NoiseListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(x: number, z: number, radius: number, tag?: string): void {
    const e: NoiseEvent = { x, z, radius, tag };
    for (const l of this.listeners) l(e);
  }

  /** Distance-based helper: true if point is inside a prior emit (caller tracks). */
  static inRadius(e: NoiseEvent, x: number, z: number): boolean {
    return Math.hypot(x - e.x, z - e.z) <= e.radius;
  }
}
