// Netplay orchestrator: owns the host/join state machine, the peer connection
// and the HELLO handshake. The game only talks to this class.

import { Signaling } from './signaling';
import { Peer } from './peer';
import {
  MSG, PROTO_VERSION, encodeHello, decodeHello, encodeInput, decodeInput,
  unwrap, decodeEvent, encodeEvent, SnapshotEnemy, SnapshotAlly, decodeSnapshot, BTN,
} from './protocol';

export type NetState = 'off' | 'signaling' | 'connecting' | 'syncing' | 'ready' | 'error';
export type NetMode = 'off' | 'host' | 'client';

export interface NetHooks {
  onState: (s: NetState, code: string) => void;
  onError: (msg: string) => void;
  /** Both sides, after HELLO: start the match with the agreed seed. */
  onStart: (seed: number, pvp: boolean) => void;
  /** Host only: the remote player's input frame (50Hz). */
  onInput: (f: { seq: number; btn: number; yaw: number; pitch: number; mx: number; mz: number }) => void;
  /** Client only: authoritative world snapshot (20Hz). */
  onSnapshot: (s: { tick: number; hp: number; pos: [number, number, number]; enemies: SnapshotEnemy[]; allies: SnapshotAlly[] }) => void;
  /** Both: gameplay event envelope. */
  onEvent: (sub: number, args: DataView) => void;
  /** Host only: the remote player pulled the trigger (visual only). */
  onRemoteShot: () => void;
}

export class Netplay {
  mode: NetMode = 'off';
  state: NetState = 'off';
  code = '';
  agreedSeed = 0;
  agreedPvp = false;
  agreedScale = 2;
  private peer: Peer | null = null;
  private helloDone = false;
  private inputSeq = 0;
  private prevBtn = 0;

  constructor(private hooks: NetHooks) {}

  private setState(s: NetState) {
    // monotonic guard: once the handshake reached 'ready', infrastructure
    // callbacks (a second DataChannel opening, a late connectionStateChange)
    // must never downgrade it again — that disabled the snapshot pump mid-match
    if (this.state === 'ready' && (s === 'connecting' || s === 'signaling' || s === 'syncing')) return;
    this.state = s;
    this.hooks.onState(s, this.code);
  }

  private fail(msg: string) {
    this.setState('error');
    this.hooks.onError(msg);
    this.close();
  }

  /** Host: create a room and wait for a joiner. Resolves with the room code. */
  async host(seed: number, scale: number, pvp: boolean): Promise<string> {
    this.mode = 'host';
    this.agreedSeed = seed;
    this.agreedScale = scale;
    this.agreedPvp = pvp;
    this.setState('signaling');
    this.peer = new Peer('host', {
      onOpen: () => this.setState('connecting'),
      onClose: () => this.teardown('连接断开'),
      onMessage: (ch, data) => this.onMessage(ch, data),
      onState: (st) => {
        if (st === 'failed') this.fail('WebRTC 连接失败');
      },
    });
    try {
      const offer = await this.peer.createOffer();
      this.code = await Signaling.publish('', 'offer', offer);
      // re-emit now that the code exists — the room UI reads it from here
      this.setState('signaling');
      const answer = await Signaling.waitAnswer(this.code, 90);
      this.setState('connecting');
      await this.peer.acceptAnswer(answer);
    } catch (e) {
      this.fail(e instanceof Error ? e.message : String(e));
    }
    return this.code;
  }

  /** Client: join by room code. */
  async join(codeRaw: string): Promise<void> {
    this.mode = 'client';
    this.code = codeRaw.toUpperCase();
    this.setState('connecting');
    this.peer = new Peer('client', {
      onOpen: () => {
        // THE HANDSHAKE INITIATOR: the client says hello first, the host
        // replies with the authoritative seed. Without this nothing starts.
        // NOTE: the encode* helpers already build the [type][len] envelope —
        // do NOT wrap again (double-wrapping shifted every field and made
        // seed/pvp decode as garbage on the peer).
        this.peer?.send('rel', encodeHello(PROTO_VERSION, 0, 0, false));
      },
      onClose: () => this.teardown('连接断开'),
      onMessage: (ch, data) => this.onMessage(ch, data),
      onState: (st) => {
        if (st === 'failed') this.fail('WebRTC 连接失败');
      },
    });
    try {
      const offer = await Signaling.fetchSlot(this.code, 'offer', 90);
      const answer = await this.peer.acceptOffer(offer);
      await Signaling.publish(this.code, 'answer', answer);
    } catch (e) {
      this.fail(e instanceof Error ? e.message : String(e));
    }
  }

  private onMessage(_ch: 'rel' | 'unrel', data: ArrayBuffer) {
    const { type, payload } = unwrap(data);
    if (type === MSG.HELLO && !this.helloDone) {
      this.helloDone = true;
      const h = decodeHello(payload);
      if (h.ver !== PROTO_VERSION) {
        this.fail('版本不一致——请双方都刷新页面');
        return;
      }
      if (this.mode === 'host') {
        // host: the client's HELLO is just a greeting — OUR seed/pvp/scale win
        this.peer?.send('rel', encodeHello(PROTO_VERSION, this.agreedSeed, this.agreedScale, this.agreedPvp));
      } else {
        // client: adopt the host's authoritative parameters
        this.agreedSeed = h.seed;
        this.agreedPvp = h.pvp;
        this.agreedScale = h.scale;
      }
      this.setState('ready');
      this.hooks.onStart(this.agreedSeed, this.agreedPvp);
      return;
    }
    if (type === MSG.PING) {
      this.peer?.send('rel', data); // echo for RTT
      return;
    }
    if (type === MSG.INPUT && this.mode === 'host') {
      const f = decodeInput(payload);
      // rising edge of the client's trigger: let the host SEE the ghost fire
      if (!(this.prevBtn & BTN.FIRE) && f.btn & BTN.FIRE) this.hooks.onRemoteShot?.();
      this.prevBtn = f.btn;
      this.hooks.onInput?.(f);
      return;
    }
    if (type === MSG.SNAPSHOT && this.mode === 'client') {
      this.hooks.onSnapshot?.(decodeSnapshot(payload));
      return;
    }
    if (type === MSG.EVENT) {
      const { sub, args } = decodeEvent(payload);
      this.hooks.onEvent?.(sub, args);
    }
  }

  /** Client: publish the local input frame (unreliable, 50Hz). */
  sendInput(btn: number, yaw: number, pitch: number, mx: number, mz: number) {
    if (this.mode !== 'client' || !this.peer || this.state !== 'ready') return;
    this.peer.send('unrel', encodeInput(this.inputSeq++ & 0xffff, btn, yaw, pitch, mx, mz));
  }

  /** Host: broadcast a world snapshot (unreliable, 20Hz).
   *  encodeSnapshot already writes the [type][len] envelope — send as-is. */
  sendSnapshot(payload: ArrayBuffer) {
    if (this.mode !== 'host' || !this.peer || this.state !== 'ready') return;
    this.peer.send('unrel', payload);
  }

  /** Both: reliable gameplay event. (encodeEvent already envelopes itself) */
  sendEvent(sub: number, args: ArrayBuffer) {
    if (!this.peer) return;
    this.peer.send('rel', encodeEvent(sub, args));
  }

  teardown(reason?: string) {
    this.fail(reason || '连接已断开');
  }

  close() {
    this.peer?.close(true); // silent — leaving voluntarily is not an error
    this.peer = null;
    this.helloDone = false;
    if (this.code) void Signaling.cleanup(this.code).catch(() => {});
    this.mode = 'off';
    this.setState('off');
  }
}
