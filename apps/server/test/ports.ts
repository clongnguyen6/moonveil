// Tests listen on OS-assigned ephemeral ports (port 0), so concurrent runs by several owners never collide.
// Fails fast instead of hanging.
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

export function listenFree(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}
