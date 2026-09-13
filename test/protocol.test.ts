import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeHello, decodeHello, encodeInput, decodeInput,
  encodeSnapshot, decodeSnapshot, unwrap, MSG,
} from '../src/net/protocol';

describe('net protocol round-trips', () => {
  it('hello round-trips', () => {
    // encodeHello returns a FULL message (type+len+payload) — send-ready
    const { type, payload } = unwrap(encodeHello(1, 123456789, 2, true));
    assert.equal(type, MSG.HELLO);
    const h = decodeHello(payload);
    assert.deepEqual(h, { ver: 1, seed: 123456789, scale: 2, pvp: true });
  });

  it('input round-trips with clamped analog values', () => {
    const msg = encodeInput(4242, 0b101, 1.234, -0.567, 0.8, -0.4);
    const i = decodeInput(unwrap(msg).payload);
    assert.equal(i.seq, 4242);
    assert.equal(i.btn, 0b101);
    assert.ok(Math.abs(i.yaw - 1.234) < 1e-6);
    assert.ok(Math.abs(i.pitch + 0.567) < 1e-6);
    assert.ok(Math.abs(i.mx - 0.8) < 0.02); // i8 quantisation
    assert.ok(Math.abs(i.mz + 0.4) < 0.01);
  });

  it('snapshot round-trips with 24 enemies', () => {
    const enemies = Array.from({ length: 24 }, (_, i) => ({
      id: i, x: 10 + i, z: -5 + i * 2, yaw: i * 0.26, hp: (i * 11) % 256, flags: i % 2,
    }));
    const allies = [
      { id: 0, x: 1, z: 2, hp: 55, flags: 0 },
      { id: 1, x: 3, z: 4, hp: 10, flags: 1 },
    ];
    const msg = encodeSnapshot(7, 88, 3.5, 1.2, -9.9, enemies, allies);
    const s = decodeSnapshot(unwrap(msg).payload);
    assert.equal(s.tick, 7);
    assert.equal(s.hp, 88);
    assert.equal(s.pos[0], 3.5);
    assert.equal(s.enemies.length, 24);
    assert.equal(s.enemies[23].x, 10 + 23);
    assert.equal(s.enemies[23].flags, 1);
    assert.equal(s.enemies[23].id, 23);
    assert.equal(s.allies.length, 2);
    assert.equal(s.allies[1].id, 1);
    assert.equal(s.allies[1].flags, 1);
  });
});
