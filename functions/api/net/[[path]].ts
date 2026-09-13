// Multiplayer signaling — Cloudflare Pages Functions (free plan).
// Room lifecycle is a tiny handshake: host writes an offer, joiner writes an
// answer, both poll a few times, then everything is deleted. All state lives
// in KV with a 5-minute TTL — no Durable Objects, no long connections.
// Route shapes (mirrors the local vite mock exactly):
//   POST   /api/net/room              {code, offer}  — create a room
//   GET    /api/net/room/{CODE}/offer — joiner fetches the offer
//   POST   /api/net/room/{CODE}/answer — joiner posts the answer
//   GET    /api/net/room/{CODE}/answer — host polls for the answer
//   DELETE /api/net/room/{CODE}        — cleanup (after handshake or TTL)

interface Env {
  NET_SIGNALING: KVNamespace;
}

const TTL = 300; // seconds — handshake completes (or dies) well within this
const CODE_RE = /^[A-Z2-9]{4}$/; // 4-char room code, no confusing glyphs

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const key = (code: string, what: string) => `nr:room:${code}:${what}`;

/** `[[path]]` catch-all: params.path is a STRING[] of segments (not a joined
 *  string) — normalise both shapes into a clean segment array. */
function segs(path: unknown): string[] {
  if (Array.isArray(path)) return path.map(String);
  return String(path ?? '')
    .split('/')
    .filter(Boolean);
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const parts = segs(params.path);
  // GET /api/net/room/{CODE}/{slot}
  const code = parts[1] || '';
  const slot = parts[2] || '';
  if (!CODE_RE.test(code)) return json({ error: `bad code GET [${parts.join('|')}] code=${JSON.stringify(code)} codes=${[...code].map((c) => c.charCodeAt(0)).join(',')}` }, 400);
  if (slot !== 'offer' && slot !== 'answer') return json({ error: `bad slot GET [${parts.join('|')}]` }, 400);
  const rec = await env.NET_SIGNALING.get(key(code, slot));
  if (!rec) return json({ error: 'not found' }, 404);
  return json(JSON.parse(rec));
};

export const onRequestPost: PagesFunction<Env> = async ({ request, params, env }) => {
  const parts = segs(params.path);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  // POST /api/net/room — create: body {code, offer}
  if (parts[0] === 'room' && parts.length === 1) {
    const create = body as { code?: string; offer?: unknown };
    const code = String(create.code || '');
    if (!CODE_RE.test(code)) return json({ error: 'bad code' }, 400);
    const existing = await env.NET_SIGNALING.get(key(code, 'offer'));
    if (existing) return json({ error: 'room taken' }, 409);
    await env.NET_SIGNALING.delete(key(code, 'answer'));
    await env.NET_SIGNALING.put(key(code, 'offer'), JSON.stringify(create.offer), {
      expirationTtl: TTL,
    });
    return json({ ok: true, code });
  }

  // POST /api/net/room/{CODE}/{slot} — publish offer/answer
  const code = parts[1] || '';
  const slot = parts[2] || '';
  if (!CODE_RE.test(code)) return json({ error: `bad code POST [${parts.join('|')}] code=${JSON.stringify(code)} codes=${[...code].map((c) => c.charCodeAt(0)).join(',')}` }, 400);
  if (slot !== 'offer' && slot !== 'answer') return json({ error: `bad slot POST [${parts.join('|')}]` }, 400);
  if (slot === 'offer') {
    const existing = await env.NET_SIGNALING.get(key(code, 'offer'));
    if (existing) return json({ error: 'room taken' }, 409);
    await env.NET_SIGNALING.delete(key(code, 'answer'));
  }
  await env.NET_SIGNALING.put(key(code, slot), JSON.stringify(body), {
    expirationTtl: TTL,
  });
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  const parts = segs(params.path);
  const code = parts[1] || '';
  if (!CODE_RE.test(code)) return json({ error: `bad code DEL [${parts.join('|')}]` }, 400);
  await env.NET_SIGNALING.delete(key(code, 'offer'));
  await env.NET_SIGNALING.delete(key(code, 'answer'));
  return json({ ok: true });
};
