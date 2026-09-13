/**
 * MapBuilder — unified map modes (seeded / fixed / stream).
 * Framework owns the contract; content packages supply generators and assets.
 */
import type { MapSpec, FixedMapDef } from '../content/define';

export interface MapBuildContext {
  seed?: number;
  fixedId?: string;
}

export interface BuiltMap {
  kind: MapSpec['kind'];
  seed?: number;
  fixed?: FixedMapDef;
  /** Free-form payload the sample interprets (terrain, obstacles, POIs…). */
  data: unknown;
}

export type SeededGen = (seed: number) => unknown;
export type FixedLoader = (def: FixedMapDef) => unknown;
export type StreamFactory = (spec: Extract<MapSpec, { kind: 'stream' }>) => unknown;

export interface MapBuilderDeps {
  seeded?: SeededGen;
  fixed?: FixedLoader;
  stream?: StreamFactory;
}

/**
 * Build a map from a MapSpec. Unknown kinds or missing loaders throw so
 * content authors fail fast instead of silently getting an empty world.
 */
export function buildMap(spec: MapSpec, deps: MapBuilderDeps, ctx: MapBuildContext = {}): BuiltMap {
  switch (spec.kind) {
    case 'seeded': {
      if (!deps.seeded) throw new Error('MapBuilder: seeded loader not provided');
      const seed = ctx.seed ?? ((Math.random() * 1e9) | 0);
      return { kind: 'seeded', seed, data: deps.seeded(seed) };
    }
    case 'fixed': {
      if (!deps.fixed) throw new Error('MapBuilder: fixed loader not provided');
      const def = spec.maps.find((m) => m.id === ctx.fixedId) ?? spec.maps[0];
      if (!def) throw new Error('MapBuilder: fixed spec has no maps');
      return { kind: 'fixed', fixed: def, data: deps.fixed(def) };
    }
    case 'stream': {
      if (!deps.stream) throw new Error('MapBuilder: stream factory not provided');
      return { kind: 'stream', data: deps.stream(spec) };
    }
    default: {
      const never: never = spec;
      throw new Error(`MapBuilder: unknown map kind ${JSON.stringify(never)}`);
    }
  }
}
