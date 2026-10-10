import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';
import { shutdownServer } from './shutdown';

describe('shutdownServer', () => {
  it('closes the HTTP server and then disconnects the database', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const events: string[] = [];
    await shutdownServer(server, async () => {
      events.push(server.listening ? 'still-listening' : 'closed');
      events.push('disconnected');
    });

    assert.deepEqual(events, ['closed', 'disconnected']);
  });
});
