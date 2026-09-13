/**
 * WaveDirector — spawn waves from a table. Opt-in; call update yourself.
 */
export interface WaveDef {
  /** Units to spawn this wave. */
  count: number;
  /** Seconds between spawns. */
  interval: number;
  /** Delay before this wave starts (after previous finishes). */
  delay?: number;
  /** Payload passed to spawnFn (unit key, etc.). */
  unit?: string;
}

export interface WaveDirectorOpts {
  waves: WaveDef[];
  spawnFn: (wave: WaveDef, index: number) => void;
  /** Wave index just completed (0-based). */
  onWaveComplete?: (waveIndex: number) => void;
  onAllComplete?: () => void;
  /** Auto-start first wave after first delay. */
  autoStart?: boolean;
}

export class WaveDirector {
  private waves: WaveDef[];
  private spawnFn: WaveDirectorOpts['spawnFn'];
  private onWaveComplete?: WaveDirectorOpts['onWaveComplete'];
  private onAllComplete?: WaveDirectorOpts['onAllComplete'];

  private waveIndex = -1;
  private spawned = 0;
  private timer = 0;
  private waiting = true;
  private done = false;

  constructor(opts: WaveDirectorOpts) {
    this.waves = opts.waves.slice();
    this.spawnFn = opts.spawnFn;
    this.onWaveComplete = opts.onWaveComplete;
    this.onAllComplete = opts.onAllComplete;
    if (opts.autoStart !== false) this.start();
  }

  get currentWave(): number {
    return Math.max(0, this.waveIndex);
  }

  get waveNumber(): number {
    return this.currentWave + 1;
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  get finished(): boolean {
    return this.done;
  }

  get remainingInWave(): number {
    if (this.waveIndex < 0 || this.waveIndex >= this.waves.length) return 0;
    return Math.max(0, this.waves[this.waveIndex].count - this.spawned);
  }

  start(): void {
    if (this.waveIndex >= 0) return;
    this.nextWave();
  }

  /** Force start next wave immediately (skip remaining delay). */
  skipDelay(): void {
    if (!this.waiting || this.done) return;
    this.timer = 0;
  }

  update(dt: number): void {
    if (this.done || this.waveIndex < 0) return;
    const wave = this.waves[this.waveIndex];
    if (this.waiting) {
      this.timer -= dt;
      if (this.timer > 0) return;
      this.waiting = false;
      this.timer = 0;
    }
    if (this.spawned >= wave.count) {
      this.onWaveComplete?.(this.waveIndex);
      this.nextWave();
      return;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.spawnFn(wave, this.spawned);
      this.spawned++;
      this.timer = wave.interval;
    }
  }

  private nextWave(): void {
    this.waveIndex++;
    this.spawned = 0;
    if (this.waveIndex >= this.waves.length) {
      this.done = true;
      this.onAllComplete?.();
      return;
    }
    const w = this.waves[this.waveIndex];
    this.waiting = true;
    this.timer = w.delay ?? 0;
    if (this.timer <= 0) this.waiting = false;
  }
}
