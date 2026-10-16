// TLS front door for the spike: one https origin serving the page/API (-> spike server 4302)
// and LiveKit signaling (-> 4300) so a phone-like client gets a secure context and wss://.
// Stands in for Caddy/nginx in production. Port 4303. Certs: .certs/leaf.{crt,key} (gitignored).
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.VOICE_TLS_PORT || 4303);
const APP = { host: '127.0.0.1', port: 4302 };
const LK = { host: '127.0.0.1', port: 4300 };
const toLiveKit = (url) => url.startsWith('/rtc') || url.startsWith('/twirp');

const server = https.createServer({
  cert: fs.readFileSync(path.join(dir, '.certs/leaf.crt')),
  key: fs.readFileSync(path.join(dir, '.certs/leaf.key')),
}, (req, res) => {
  const target = toLiveKit(req.url) ? LK : APP;
  const up = http.request({ ...target, method: req.method, path: req.url, headers: { ...req.headers, host: `${target.host}:${target.port}`, 'x-forwarded-proto': 'https', 'x-forwarded-host': req.headers.host } }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on('error', () => { res.writeHead(502); res.end('upstream down'); });
  req.pipe(up);
});

// WebSocket upgrades: raw TCP splice after rewriting the Host header.
server.on('upgrade', (req, socket, head) => {
  const target = toLiveKit(req.url) ? LK : APP;
  const up = net.connect(target.port, target.host, () => {
    const headers = Object.entries(req.headers).filter(([k]) => k !== 'host').map(([k, v]) => `${k}: ${v}`).join('\r\n');
    up.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\nhost: ${target.host}:${target.port}\r\nx-forwarded-proto: https\r\nx-forwarded-host: ${req.headers.host}\r\n${headers}\r\n\r\n`);
    if (head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(PORT, '127.0.0.1', () => console.log(`tls proxy https://127.0.0.1:${PORT} (SAN camp.local) -> app ${APP.port}, livekit ${LK.port}`));
