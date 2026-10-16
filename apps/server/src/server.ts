// HTTP (static web build + SPA fallback + /healthz) and WebSocket (/ws) on one port.
import { createReadStream, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { HEARTBEAT_MS, MAX_FRAME_BYTES, parseClientMessage, type ServerMessage, WS_PATH, CLOSE } from '@moonveil/protocol';
import { WebSocket, WebSocketServer } from 'ws';
import { Registry, type RegistryOptions, Session } from './rooms.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
};

export interface ServerOptions extends RegistryOptions {
  staticDir?: string;
  heartbeatMs?: number;
  // LAN base URLs players can reach (empty when bound to loopback). Served at GET /api/lan.
  lanUrls?: () => string[];
}

// Same-origin check (CSWSH). Non-browser clients send no Origin and are allowed.
function originOk(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function createMoonveilServer(opts: ServerOptions): { http: Server; registry: Registry; stop: () => Promise<void> } {
  const registry = new Registry(opts);
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  const staticDir = opts.staticDir ? normalize(opts.staticDir) : null;

  const http = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    if (url.pathname === '/api/lan' && req.method === 'GET') {
      res
        .writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
        .end(JSON.stringify({ urls: opts.lanUrls?.() ?? [] }));
      return;
    }
    if (!staticDir || (req.method !== 'GET' && req.method !== 'HEAD')) {
      res.writeHead(404).end();
      return;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let file = normalize(join(staticDir, decoded));
    if (file !== staticDir && !file.startsWith(staticDir + sep)) {
      res.writeHead(400).end();
      return;
    }
    let st = statSync(file, { throwIfNoEntry: false });
    if (!st || st.isDirectory()) {
      // SPA routes (/r/CODE) fall back to index.html; missing assets 404.
      if (extname(url.pathname)) {
        res.writeHead(404).end();
        return;
      }
      file = join(staticDir, 'index.html');
      st = statSync(file, { throwIfNoEntry: false });
      if (!st) {
        res.writeHead(404).end();
        return;
      }
    }
    const immutable = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  });

  http.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    if (path !== WS_PATH || !originOk(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const alive = new WeakMap<WebSocket, boolean>();
  wss.on('connection', (ws: WebSocket) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    const session = new Session(registry, {
      send: (m: ServerMessage) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
      },
      close: (code, reason) => ws.close(code, reason),
    });
    ws.on('message', (data, isBinary) => {
      const msg = isBinary ? null : parseClientMessage(data.toString());
      if (!msg) {
        ws.send(JSON.stringify({ t: 'error', code: 'bad-message', message: 'invalid message' } satisfies ServerMessage));
        return;
      }
      try {
        session.receive(msg);
      } catch (e) {
        console.error('session error', e);
        ws.close(CLOSE.protocol, 'server error');
      }
    });
    ws.on('close', () => session.closed());
    ws.on('error', () => ws.terminate());
  });

  // Transport heartbeat (ws ping) + app heartbeat (browsers can't see pings; client watchdog uses `hb`).
  const hb = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'hb', now: (opts.now ?? Date.now)() } satisfies ServerMessage));
    }
    registry.sweep();
  }, opts.heartbeatMs ?? HEARTBEAT_MS);

  const stop = () =>
    new Promise<void>((resolve) => {
      clearInterval(hb);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      http.close(() => resolve());
      http.closeAllConnections();
    });

  return { http, registry, stop };
}
