/**
 * ProcDungeon — seeded room graph + corridors. Pure layout, no three/physics.
 */
export interface RoomDef {
  id: string;
  /** grid cell */
  gx: number;
  gz: number;
  w: number;
  h: number;
  kind: 'start' | 'combat' | 'loot' | 'boss';
}

export interface Corridor {
  a: string;
  b: string;
}

export interface DungeonLayout {
  seed: number;
  rooms: RoomDef[];
  corridors: Corridor[];
  /** world-space room center helper */
  roomCenter(room: RoomDef, cellSize: number): { x: number; z: number };
}

export interface ProcDungeonOpts {
  roomCount?: number;
  cellSize?: number;
  roomW?: number;
  roomH?: number;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDungeon(seed: number, opts: ProcDungeonOpts = {}): DungeonLayout {
  const roomCount = Math.max(3, opts.roomCount ?? 6);
  const cellSize = opts.cellSize ?? 18;
  const rw = opts.roomW ?? 10;
  const rh = opts.roomH ?? 10;
  const rand = mulberry32(seed >>> 0);

  const rooms: RoomDef[] = [];
  const taken = new Set<string>();
  // start at 0,0
  let gx = 0;
  let gz = 0;
  rooms.push({ id: 'r0', gx, gz, w: rw, h: rh, kind: 'start' });
  taken.add(`${gx},${gz}`);

  for (let i = 1; i < roomCount; i++) {
    // random walk from last room
    let placed = false;
    for (let tries = 0; tries < 20 && !placed; tries++) {
      const dir = Math.floor(rand() * 4);
      let nx = gx;
      let nz = gz;
      if (dir === 0) nx += 1;
      else if (dir === 1) nx -= 1;
      else if (dir === 2) nz += 1;
      else nz -= 1;
      const key = `${nx},${nz}`;
      if (taken.has(key)) continue;
      gx = nx;
      gz = nz;
      taken.add(key);
      const kind: RoomDef['kind'] =
        i === roomCount - 1 ? 'boss' : rand() < 0.25 ? 'loot' : 'combat';
      rooms.push({ id: `r${i}`, gx, gz, w: rw, h: rh, kind });
      placed = true;
    }
    if (!placed) {
      // fallback stamp outward
      gx += 1;
      taken.add(`${gx},${gz}`);
      rooms.push({ id: `r${i}`, gx, gz, w: rw, h: rh, kind: i === roomCount - 1 ? 'boss' : 'combat' });
    }
  }

  // chain corridors in room order + link each room to nearest previous
  const corridors: Corridor[] = [];
  for (let i = 1; i < rooms.length; i++) {
    corridors.push({ a: rooms[i - 1].id, b: rooms[i].id });
  }

  return {
    seed,
    rooms,
    corridors,
    roomCenter(room, cs = cellSize) {
      return { x: room.gx * cs, z: room.gz * cs };
    },
  };
}

/** BFS connectivity over corridor graph. */
export function isDungeonConnected(layout: DungeonLayout): boolean {
  if (layout.rooms.length === 0) return false;
  const adj = new Map<string, string[]>();
  for (const r of layout.rooms) adj.set(r.id, []);
  for (const c of layout.corridors) {
    adj.get(c.a)?.push(c.b);
    adj.get(c.b)?.push(c.a);
  }
  const start = layout.rooms[0].id;
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const cur = q.pop()!;
    for (const n of adj.get(cur) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        q.push(n);
      }
    }
  }
  return seen.size === layout.rooms.length;
}
