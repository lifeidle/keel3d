/**
 * AssetHub — lazy, cached loading of audio samples and textures.
 * Nothing is fetched until a key is requested; callers may preload.
 */

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface AudioEntry {
  state: LoadState;
  promise: Promise<AudioBuffer | null> | null;
  buffer: AudioBuffer | null;
}

export class AssetHub {
  private audioCtx: AudioContext | null = null;
  private audio = new Map<string, AudioEntry>();
  private textures = new Map<string, Promise<THREE_Texture | null>>();

  /** Attach an AudioContext (user-gesture). */
  useAudioContext(ctx: AudioContext): void {
    this.audioCtx = ctx;
  }

  /**
   * Decode one sample. Concurrent callers share the same fetch.
   * Returns null on failure so callers can fall back silently.
   */
  loadAudio(url: string): Promise<AudioBuffer | null> {
    let e = this.audio.get(url);
    if (e?.state === 'ready') return Promise.resolve(e.buffer);
    if (e?.promise) return e.promise;
    e = { state: 'loading', promise: null, buffer: null };
    this.audio.set(url, e);
    e.promise = (async () => {
      try {
        const ctx = this.audioCtx;
        if (!ctx) throw new Error('AudioContext not ready');
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const raw = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(raw);
        e!.buffer = buf;
        e!.state = 'ready';
        return buf;
      } catch {
        e!.state = 'error';
        return null;
      }
    })();
    return e.promise;
  }

  getCachedAudio(url: string): AudioBuffer | null {
    return this.audio.get(url)?.buffer ?? null;
  }

  /** Fire-and-forget warmup of a list of URLs. */
  preloadAudio(urls: string[]): void {
    for (const u of urls) void this.loadAudio(u);
  }

  stats(): { audio: number; ready: number; loading: number; error: number } {
    let ready = 0;
    let loading = 0;
    let error = 0;
    for (const e of this.audio.values()) {
      if (e.state === 'ready') ready++;
      else if (e.state === 'loading') loading++;
      else if (e.state === 'error') error++;
    }
    return { audio: this.audio.size, ready, loading, error };
  }
}

// Avoid importing three here for typing only — use a local alias.
type THREE_Texture = import('three').Texture;
