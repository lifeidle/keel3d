// Thin RTCPeerConnection wrapper: dual DataChannels (reliable events /
// unreliable state snapshots), STUN-only ICE, explicit lifecycle events.
// Deliberately dependency-free — the standard API is the modern way.

export type PeerRole = 'host' | 'client';

export interface PeerEvents {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (channel: 'rel' | 'unrel', data: ArrayBuffer) => void;
  /** Human-readable connection state for the HUD. */
  onState: (s: string) => void;
}

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

export class Peer {
  pc: RTCPeerConnection;
  private rel!: RTCDataChannel;
  private unrel!: RTCDataChannel;
  private events: PeerEvents;
  private candBuf: RTCIceCandidateInit[] = [];
  private opened = false; // onOpen fires ONCE — late 'connected' reports and
  // the second DataChannel must never re-fire it (a post-HELLO re-open used
  // to knock the orchestrator's 'ready' state back to 'connecting', which
  // silently disabled the snapshot pump)

  constructor(
    readonly role: PeerRole,
    events: PeerEvents
  ) {
    this.events = {
      ...events,
      onOpen: () => {
        if (this.opened) return;
        this.opened = true;
        events.onOpen();
      },
    };
    this.events = events;
    this.pc = new RTCPeerConnection(ICE);
    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState;
      this.events.onState(st);
      if (st === 'connected') this.events.onOpen();
      if (st === 'failed' || st === 'disconnected' || st === 'closed') this.events.onClose();
    };

    if (role === 'host') {
      // host creates both channels; client listens for them
      this.rel = this.pc.createDataChannel('game-rel', { ordered: true });
      this.wireChannel(this.rel, 'rel');
      this.unrel = this.pc.createDataChannel('game-unrel', {
        ordered: false,
        maxRetransmits: 0,
      });
      this.wireChannel(this.unrel, 'unrel');
    }
    this.pc.ondatachannel = (ev) => {
      const ch = ev.channel;
      if (ch.label === 'game-rel') {
        this.rel = ch;
        this.wireChannel(ch, 'rel');
      } else if (ch.label === 'game-unrel') {
        this.unrel = ch;
        this.wireChannel(ch, 'unrel');
      }
    };
  }

  private wireChannel(ch: RTCDataChannel, which: 'rel' | 'unrel') {
    ch.binaryType = 'arraybuffer';
    ch.onopen = () => {
      // flush any ICE candidates that arrived before the channel existed
      if (which === 'rel') this.events.onOpen();
    };
    ch.onmessage = (ev) => this.events.onMessage(which, ev.data as ArrayBuffer);
    ch.onclose = () => this.events.onClose();
  }

  /** Host: create offer, collect ICE, return the record to publish. */
  async createOffer(): Promise<{ sdp: string; ice: RTCIceCandidateInit[] }> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitIce();
    return { sdp: this.pc.localDescription!.sdp, ice: this.candBuf.slice() };
  }

  /** Client: accept the host offer, create + return the answer record. */
  async acceptOffer(rec: { sdp: string; ice: RTCIceCandidateInit[] }): Promise<{ sdp: string; ice: RTCIceCandidateInit[] }> {
    await this.pc.setRemoteDescription({ type: 'offer', sdp: rec.sdp });
    for (const c of rec.ice) await this.pc.addIceCandidate(c).catch(() => {});
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitIce();
    return { sdp: this.pc.localDescription!.sdp, ice: this.candBuf.slice() };
  }

  /** Host: apply the joiner's answer. */
  async acceptAnswer(rec: { sdp: string; ice: RTCIceCandidateInit[] }): Promise<void> {
    await this.pc.setRemoteDescription({ type: 'answer', sdp: rec.sdp });
    for (const c of rec.ice) await this.pc.addIceCandidate(c).catch(() => {});
  }

  send(which: 'rel' | 'unrel', data: ArrayBuffer) {
    const ch = which === 'rel' ? this.rel : this.unrel;
    if (ch && ch.readyState === 'open') ch.send(data);
  }

  /** Close. `silent` detaches handlers first so the UI sees no "disconnect". */
  close(silent = false) {
    if (silent) {
      this.pc.onconnectionstatechange = null;
      this.pc.ondatachannel = null;
      if (this.rel) {
        this.rel.onopen = null;
        this.rel.onclose = null;
        this.rel.onmessage = null;
      }
      if (this.unrel) {
        this.unrel.onopen = null;
        this.unrel.onclose = null;
        this.unrel.onmessage = null;
      }
    }
    try {
      this.rel?.close();
      this.unrel?.close();
      this.pc.close();
    } catch {
      /* already gone */
    }
  }

  /** Gather candidates until the trickle pauses (STUN done) — max 3s. */
  private waitIce(): Promise<void> {
    return new Promise((res) => {
      const t = setTimeout(res, 3000);
      this.pc.onicecandidate = (ev) => {
        if (ev.candidate) this.candBuf.push(ev.candidate.toJSON());
        else {
          clearTimeout(t);
          res();
        }
      };
      // some browsers fire onicecandidateerror as the end signal
      setTimeout(res, 3100);
    });
  }
}
