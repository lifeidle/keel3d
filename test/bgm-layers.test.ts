/**
 * BgmLayers — two-layer calm/intense crossfade.
 * Node has no AudioContext, so a structural mock records gain wiring.
 * Covers: attach idempotency, buffer attach + loop, the crossfade gain
 * math (calm = 1 - v, intense = v), master volume, stop/detach cleanup.
 */
import assert from 'node:assert';
import { BgmLayers } from '../src/blocks/audio/BgmLayers';

/** Structural mock — records nodes; gains are observable. */
function mockAudioContext() {
  const gains: { value: number }[] = [];
  const sources: {
    buffer: unknown;
    loop: boolean;
    stopped: boolean;
    connect: (n: unknown) => void;
    stop: () => void;
    start: () => void;
  }[] = [];
  const ctx = {
    destination: { id: 'dest' },
    createGain: () => {
      const n = { value: 1 };
      const node = {
        gain: n,
        connect: (_n: unknown) => {},
        disconnect: () => {},
      };
      gains.push(n);
      return node as never;
    },
    createBufferSource: () => {
      const s = {
        buffer: null as unknown,
        loop: false,
        stopped: false,
        connect: (_n: unknown) => {},
        start: () => {},
        stop: () => {
          s.stopped = true;
        },
      };
      sources.push(s);
      return s as never;
    },
  };
  return { ctx: ctx as unknown as AudioContext, gains, sources };
}

const t = (name: string, fn: () => void) => {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name, e);
    process.exitCode = 1;
  }
};

t('attach wires master + two layer gains; idempotent on same ctx', () => {
  const m = mockAudioContext();
  const bgm = new BgmLayers();
  bgm.attach(m.ctx);
  assert.ok(bgm.attached);
  assert.strictEqual(m.gains.length, 3, 'master + calm + intense');
  bgm.attach(m.ctx); // no-op
  assert.strictEqual(m.gains.length, 3, 'still three gains after re-attach');
  bgm.detach();
  assert.ok(!bgm.attached);
});

t('setCalm/setIntense create looping sources with the given buffers', () => {
  const m = mockAudioContext();
  const bgm = new BgmLayers();
  bgm.attach(m.ctx);
  const calmBuf = { kind: 'calm' };
  const intenseBuf = { kind: 'intense' };
  bgm.setCalm(calmBuf as never);
  bgm.setIntense(intenseBuf as never);
  assert.strictEqual(m.sources.length, 2);
  assert.strictEqual(m.sources[0].buffer, calmBuf);
  assert.strictEqual(m.sources[0].loop, true, 'calm loop');
  assert.strictEqual(m.sources[1].buffer, intenseBuf);
  assert.strictEqual(m.sources[1].loop, true, 'intense loop');
  bgm.detach();
});

t('crossfade math: calm = 1 - v, intense = v (clamped)', () => {
  const m = mockAudioContext();
  const bgm = new BgmLayers();
  bgm.attach(m.ctx);
  bgm.setIntensity(0);
  assert.strictEqual(bgm.getIntensity(), 0);
  // gains[1] = calm, gains[2] = intense (master is gains[0])
  assert.strictEqual(m.gains[1].value, 1);
  assert.strictEqual(m.gains[2].value, 0);
  bgm.setIntensity(0.25);
  assert.strictEqual(m.gains[1].value, 0.75);
  assert.strictEqual(m.gains[2].value, 0.25);
  bgm.setIntensity(1.7); // clamps to 1
  assert.strictEqual(bgm.getIntensity(), 1);
  assert.strictEqual(m.gains[1].value, 0);
  assert.strictEqual(m.gains[2].value, 1);
  bgm.setIntensity(-0.4); // clamps to 0
  assert.strictEqual(bgm.getIntensity(), 0);
  bgm.detach();
});

t('master volume clamps to [0,1]', () => {
  const m = mockAudioContext();
  const bgm = new BgmLayers();
  bgm.attach(m.ctx);
  bgm.setMasterVolume(0.5);
  assert.strictEqual(m.gains[0].value, 0.5);
  bgm.setMasterVolume(3);
  assert.strictEqual(m.gains[0].value, 1);
  bgm.setMasterVolume(-1);
  assert.strictEqual(m.gains[0].value, 0);
  bgm.detach();
});

t('stop halts both sources; detach clears the ctx', () => {
  const m = mockAudioContext();
  const bgm = new BgmLayers();
  bgm.attach(m.ctx);
  bgm.setCalm({ kind: 'c' } as never);
  bgm.setIntense({ kind: 'i' } as never);
  bgm.stop();
  assert.ok(m.sources.every((s) => s.stopped), 'both sources stopped');
  bgm.stop(); // second stop is safe
  bgm.detach();
  assert.strictEqual(bgm.attached, false);
});

console.log('bgm-layers tests complete');
