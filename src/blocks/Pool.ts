/**
 * Generic object pool. Pre-allocates N items; acquire/release never allocates
 * in the steady state. Used for lights, tracers, casings, decals, etc.
 */
export class Pool<T> {
  private free: T[];
  private live = new Set<T>();

  constructor(
    private readonly factory: () => T,
    private readonly reset?: (item: T) => void,
    size = 8,
  ) {
    this.free = Array.from({ length: Math.max(1, size) }, factory);
  }

  get activeCount(): number {
    return this.live.size;
  }

  get spareCount(): number {
    return this.free.length;
  }

  acquire(): T {
    const item = this.free.pop() ?? this.factory();
    this.live.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.live.delete(item)) return;
    this.reset?.(item);
    this.free.push(item);
  }

  /** Release everything currently live. */
  releaseAll(): void {
    for (const item of [...this.live]) this.release(item);
  }

  forEachLive(fn: (item: T) => void): void {
    for (const item of this.live) fn(item);
  }
}
