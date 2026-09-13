// Signaling client: talks to the Pages Functions KV endpoints.
// Polling cadence is 1s during handshake only — this is deliberately low-tech
// (no WebSocket/DO) so the entire free tier of Cloudflare covers it.

export interface SdpRecord {
  sdp: string;
  ice: RTCIceCandidateInit[];
  createdAt?: number;
}

const API = '/api/net/room';

const genCode = (): string => {
  // 4 chars from an unambiguous alphabet (no 0/O/1/I/L)
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += abc[(Math.random() * abc.length) | 0];
  return out;
};

export class Signaling {
  /**
   * POST our SDP record to a slot. Host path (slot=offer, code='') proposes
   * random codes until one is free (server replies 409 when taken).
   */
  static async publish(code: string, slot: 'offer' | 'answer', rec: SdpRecord): Promise<string> {
    let c = code || genCode();
    for (let attempt = 0; attempt < 8; attempt++) {
      const r = await fetch(`${API}/${c}/${slot}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(rec),
      });
      if (r.ok) return c;
      if (r.status === 409) {
        c = genCode(); // room taken — propose another
        continue;
      }
      throw new Error(`publish ${slot} failed: ${r.status}`);
    }
    throw new Error('room create failed');
  }

  /** Poll a slot until it appears (or timeout). 1s cadence. */
  static async fetchSlot(code: string, slot: 'offer' | 'answer', timeoutS = 60): Promise<SdpRecord> {
    const deadline = Date.now() + timeoutS * 1000;
    while (Date.now() < deadline) {
      const r = await fetch(`${API}/${code}/${slot}`, { cache: 'no-store' });
      if (r.ok) {
        const rec = (await r.json()) as SdpRecord;
        if (rec?.sdp) return rec;
      }
      await new Promise((res) => setTimeout(res, 1000));
    }
    throw new Error(`${slot} wait timeout`);
  }

  /** Host: wait for the joiner's answer (same cadence). */
  static waitAnswer(code: string, timeoutS = 60): Promise<SdpRecord> {
    return Signaling.fetchSlot(code, 'answer', timeoutS);
  }

  static async cleanup(code: string): Promise<void> {
    try {
      await fetch(`${API}/${code}`, { method: 'DELETE' });
    } catch {
      /* best effort */
    }
  }
}
