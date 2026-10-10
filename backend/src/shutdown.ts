import type { Server } from 'node:http';

export function shutdownServer(
  server: Server,
  disconnect: () => Promise<void>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      disconnect().then(resolve, reject);
    });
  });
}
