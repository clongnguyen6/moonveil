// Free port inside Moonveil's range for tests that open real sockets. Several owners run the root check on one
// machine, so fixed ports collide. Scans MOONVEIL_TEST_PORT_BASE (default 4120)..4199; fails fast, never hangs.
import type { Server } from 'node:http';

export async function listenFree(server: Server, from = Number(process.env.MOONVEIL_TEST_PORT_BASE ?? 4120), to = 4199): Promise<number> {
  for (let port = from; port <= to; port++) {
    const ok = await new Promise<boolean>((resolve) => {
      const onError = (e: NodeJS.ErrnoException) => {
        server.off('listening', onListening);
        if (e.code === 'EADDRINUSE' || e.code === 'EACCES') resolve(false);
        else throw e;
      };
      const onListening = () => {
        server.off('error', onError);
        resolve(true);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '127.0.0.1');
    });
    if (ok) return port;
  }
  throw new Error(`no free port in ${from}-${to}`);
}
