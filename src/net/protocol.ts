// Binary wire protocol. Every message: [u8 type][u16 len BE][payload].
// Types marked UNREL go on the unreliable channel (newest-wins); the rest are
// reliable + ordered. Little-endian payload fields via DataView.

export const MSG = {
  HELLO: 0x01, // rel  both — proto handshake {ver, seed, scale, mode}
  INPUT: 0x02, // unrel C→H — local input state
  SNAPSHOT: 0x03, // unrel H→C — authoritative world state
  EVENT: 0x04, // rel  both — discrete gameplay events
  PING: 0x05, // rel  both — RTT measurement
} as const;

export type MsgType = (typeof MSG)[keyof typeof MSG];

export const PROTO_VERSION = 1;

export const NET_EVENTS = {
  SHOT: 0x01, // {who u8, muzzle f32×3, dir f32×3}
  HIT: 0x02, // {target u8, dmg u8, point f32×3}
  KILL: 0x03, // {target u8}
  EXPLOSION: 0x04, // {pos f32×3, radius u8}
  MEDKIT: 0x05, // {pos f32×3}
  MISSION: 0x06, // {state u8}
  RESPAWN: 0x07, // {who u8, pos f32×3}
  STANCE: 0x08, // {who u8, pose u8}
  INTERACT: 0x09, // {kind u8: 0=rescue 1=supply}
  SCORE: 0x0a, // {self u8, foe u8} — hunt-mode scoreboard broadcast
  RESC: 0x0b, // {} — a rescue just succeeded (client hint)
} as const;

/** Encode a HELLO handshake. */
export function encodeHello(ver: number, seed: number, scale: number, pvp: boolean): ArrayBuffer {
  const buf = new ArrayBuffer(3 + 12);
  const v = new DataView(buf);
  v.setUint8(0, MSG.HELLO);
  v.setUint16(1, 12);
  v.setUint8(3, ver);
  v.setUint32(4, seed);
  v.setUint8(8, scale);
  v.setUint8(9, pvp ? 1 : 0);
  return buf;
}

export function decodeHello(p: ArrayBuffer): { ver: number; seed: number; scale: number; pvp: boolean } {
  const v = new DataView(p);
  return { ver: v.getUint8(0), seed: v.getUint32(1), scale: v.getUint8(5), pvp: v.getUint8(6) === 1 };
}

/** Encode an input frame (client → host). Buttons as a bitmask. */
export const BTN = {
  FIRE: 1 << 0,
  ADS: 1 << 1,
  JUMP: 1 << 2,
  CROUCH: 1 << 3,
  PRONE: 1 << 4,
  INTERACT: 1 << 5,
  FLARE: 1 << 6,
} as const;

export function encodeInput(seq: number, btn: number, yaw: number, pitch: number, mx: number, mz: number): ArrayBuffer {
  const buf = new ArrayBuffer(3 + 15);
  const v = new DataView(buf);
  v.setUint8(0, MSG.INPUT);
  v.setUint16(1, 15);
  v.setUint16(3, seq & 0xffff);
  v.setUint8(5, btn);
  v.setFloat32(6, yaw);
  v.setFloat32(10, pitch);
  v.setInt8(14, Math.round(mx * 127));
  v.setInt8(15, Math.round(mz * 127));
  return buf;
}

export function decodeInput(p: ArrayBuffer): { seq: number; btn: number; yaw: number; pitch: number; mx: number; mz: number } {
  const v = new DataView(p);
  return {
    seq: v.getUint16(0),
    btn: v.getUint8(2),
    yaw: v.getFloat32(3),
    pitch: v.getFloat32(7),
    mx: v.getInt8(11) / 127,
    mz: v.getInt8(12) / 127,
  };
}

/** Encode a snapshot header (host → client). Returns header + writer for lists. */
export interface SnapshotEnemy {
  id: number; // stable slot id so clients can track ghosts across snapshots
  x: number;
  z: number;
  yaw: number;
  hp: number;
  flags: number; // bit0 downed
}

export interface SnapshotAlly {
  id: number; // stable slot id (manager ally index)
  x: number;
  z: number;
  hp: number;
  flags: number; // bit0 downed
}

export function encodeSnapshot(
  tick: number,
  hp: number,
  px: number,
  py: number,
  pz: number,
  enemies: SnapshotEnemy[],
  allies: SnapshotAlly[] = []
): ArrayBuffer {
  const body = 2 + 4 + 12 + 1 + enemies.length * 12 + 1 + allies.length * 11;
  const buf = new ArrayBuffer(3 + body);
  const v = new DataView(buf);
  v.setUint8(0, MSG.SNAPSHOT);
  v.setUint16(1, body);
  v.setUint16(3, tick & 0xffff);
  v.setUint8(5, hp);
  v.setFloat32(6, px);
  v.setFloat32(10, py);
  v.setFloat32(14, pz);
  v.setUint8(18, enemies.length);
  let o = 19;
  for (const e of enemies) {
    v.setUint8(o, e.id & 0xff); o += 1;
    v.setFloat32(o, e.x); o += 4;
    v.setFloat32(o, e.z); o += 4;
    v.setInt8(o, Math.round((e.yaw * 255) / (Math.PI * 2))); o += 1;
    v.setUint8(o, Math.max(0, Math.min(255, e.hp))); o += 1;
    v.setUint8(o, e.flags); o += 1;
  }
  v.setUint8(o, allies.length); o += 1;
  for (const a of allies) {
    v.setUint8(o, a.id & 0xff); o += 1;
    v.setFloat32(o, a.x); o += 4;
    v.setFloat32(o, a.z); o += 4;
    v.setUint8(o, Math.max(0, Math.min(255, a.hp))); o += 1;
    v.setUint8(o, a.flags); o += 1;
  }
  return buf;
}

export function decodeSnapshot(p: ArrayBuffer): {
  tick: number;
  hp: number;
  pos: [number, number, number];
  enemies: SnapshotEnemy[];
  allies: SnapshotAlly[];
} {
  const v = new DataView(p);
  const tick = v.getUint16(0);
  const hp = v.getUint8(2);
  const pos: [number, number, number] = [v.getFloat32(3), v.getFloat32(7), v.getFloat32(11)];
  const n = v.getUint8(15);
  const enemies: SnapshotEnemy[] = [];
  let o = 16;
  for (let i = 0; i < n; i++) {
    const id = v.getUint8(o); o += 1;
    const x = v.getFloat32(o); o += 4;
    const z = v.getFloat32(o); o += 4;
    const yaw = (v.getInt8(o) / 255) * Math.PI * 2; o += 1;
    const hp = v.getUint8(o); o += 1;
    const flags = v.getUint8(o); o += 1;
    enemies.push({ id, x, z, yaw, hp, flags });
  }
  const allies: SnapshotAlly[] = [];
  const na = v.getUint8(o); o += 1;
  for (let i = 0; i < na; i++) {
    const id = v.getUint8(o); o += 1;
    const x = v.getFloat32(o); o += 4;
    const z = v.getFloat32(o); o += 4;
    const hp = v.getUint8(o); o += 1;
    const flags = v.getUint8(o); o += 1;
    allies.push({ id, x, z, hp, flags });
  }
  return { tick, hp, pos, enemies, allies };
}

/** Generic event envelope: EVENT type + sub type + args. */
export function encodeEvent(sub: number, args: ArrayBuffer): ArrayBuffer {
  const buf = new ArrayBuffer(3 + 1 + args.byteLength);
  const v = new DataView(buf);
  v.setUint8(0, MSG.EVENT);
  v.setUint16(1, args.byteLength + 1);
  v.setUint8(3, sub);
  new Uint8Array(buf, 4).set(new Uint8Array(args));
  return buf;
}

export function decodeEvent(p: ArrayBuffer): { sub: number; args: DataView } {
  const v = new DataView(p);
  return { sub: v.getUint8(0), args: new DataView(p, 1) };
}

/** Wrap a typed payload into the [type][len] envelope. */
export function envelope(type: MsgType, payload: ArrayBuffer): ArrayBuffer {
  const buf = new ArrayBuffer(3 + payload.byteLength);
  const v = new DataView(buf);
  v.setUint8(0, type);
  v.setUint16(1, payload.byteLength);
  new Uint8Array(buf, 3).set(new Uint8Array(payload));
  return buf;
}

/** Strip the envelope; returns [type, payload view]. */
export function unwrap(data: ArrayBuffer): { type: MsgType; payload: ArrayBuffer } {
  const v = new DataView(data);
  const type = v.getUint8(0) as MsgType;
  const len = v.getUint16(1);
  return { type, payload: data.slice(3, 3 + len) };
}
