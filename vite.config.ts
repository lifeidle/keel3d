import { defineConfig } from 'vite';

// 夜袭 / Night Raid - Vite config
// base: './' keeps asset paths relative so the build runs from any sub-path
// (Cloudflare Pages, GitHub Pages, or a plain static file server).
// manualChunks splits the two heavy vendors into cacheable files: app updates
// no longer invalidate the three/rapier cache (rapier carries the inlined WASM).

// Local signaling mock for netplay development (`npm run net:dev`).
// Mirrors the Pages Functions KV semantics (functions/api/net) in memory, so
// two browser tabs on this dev server can complete a full handshake.
function netSignalingMock() {
  const rooms = new Map(); // "CODE:slot" -> JSON string
  const CODE_RE = /^[A-Z2-9]{4}$/;
  return {
    name: 'net-signaling-mock',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (!req.url || !req.url.startsWith('/api/net/')) return next();
        const path = req.url.slice('/api/net'.length); // "/room" | "/room/CODE/slot"
        const parts = path.split('/').filter(Boolean);
        const send = (status: number, data: unknown) => {
          (res as any).statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(data));
        };
        const readBody = (cb: (raw: string) => void) => {
          let raw = '';
          (req as any).on('data', (c: Buffer) => (raw += c));
          (req as any).on('end', () => cb(raw));
        };

        // POST /api/net/room — create: body {code, offer}
        if (req.method === 'POST' && parts[0] === 'room' && parts.length === 1) {
          return readBody((raw) => {
            try {
              const body = JSON.parse(raw);
              const code = String(body.code || '');
              if (!/^[A-Z2-9]{4}$/.test(code)) return send(400, { error: 'bad code' });
              rooms.delete(`${code}:answer`);
              rooms.set(`${code}:offer`, JSON.stringify(body.offer));
              send(200, { ok: true, code });
            } catch {
              send(400, { error: 'bad json' });
            }
          });
        }
        // everything else needs a CODE
        const code = parts[1] || '';
        const slot = parts[2] || '';
        if (!/^[A-Z2-9]{4}$/.test(code)) return send(400, { error: 'bad code' });
        const key = `${code}:${slot}`;
        // POST /api/net/room/CODE/offer — host publishes (409 if taken)
        if (req.method === 'POST' && slot === 'offer') {
          return readBody((raw) => {
            const existing = rooms.get(key);
            if (existing) return send(409, { error: 'room taken' });
            rooms.delete(`${code}:answer`);
            rooms.set(key, raw);
            send(200, { ok: true });
          });
        }
        // POST /api/net/room/CODE/answer — joiner posts the answer
        if (req.method === 'POST' && slot === 'answer') {
          return readBody((raw) => {
            rooms.set(key, raw);
            send(200, { ok: true });
          });
        }
        if (req.method === 'GET' && (slot === 'offer' || slot === 'answer')) {
          const rec = rooms.get(key);
          if (!rec) return send(404, { error: 'not found' });
          return send(200, JSON.parse(rec));
        }
        if (req.method === 'DELETE') {
          rooms.delete(`${code}:offer`);
          rooms.delete(`${code}:answer`);
          return send(200, { ok: true });
        }
        send(400, { error: 'unsupported' });
      });
    },
  };
}

export default defineConfig({
  plugins: [netSignalingMock()],
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    // esnext: no down-transpiling (framework is WebGPU-only, no backward compat).
    // Also required by rapier's wasm instantiation (top-level await in the shim).
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false, // production: no .map artifacts (nothing internal to leak)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/@dimforge')) return 'rapier';
        },
      },
    },
  },
});
