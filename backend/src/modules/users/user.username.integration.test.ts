import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.API_PREFIX = '/api/v1';
process.env.CORS_ORIGINS = 'http://localhost:8081';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-must-be-32-characters';

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('usernames and user search', () => {
  before(async () => {
    memory = await MongoMemoryServer.create({ binary: { checkMD5: false } });
    process.env.MONGODB_URI = memory.getUri();
    const { resetEnvCache } = await import('../../config/env');
    resetEnvCache();
    const { connectDatabase } = await import('../../config/database');
    await connectDatabase();
    const { createApp } = await import('../../app');
    server = createServer(createApp());
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
    await memory.stop();
  });

  it('registers with username, enforces uniqueness, and searches users', async () => {
    const available = await send('GET', '/api/v1/auth/username-available?username=gajendra');
    assert.equal(available.status, 200);
    assert.equal(json<{ success: true; data: { available: boolean } }>(available).data.available, true);

    const ada = await register('Ada Lovelace', 'ada@example.com', 'gajendra');
    assert.equal(ada.user.username, 'gajendra');

    const taken = await send('GET', '/api/v1/auth/username-available?username=GAJENDRA');
    assert.equal(json<{ success: true; data: { available: boolean; reason: string } }>(taken).data.available, false);

    const duplicate = await send('POST', '/api/v1/auth/register', {
      name: 'Other',
      email: 'other@example.com',
      username: 'gajendra',
      password,
    });
    assert.equal(duplicate.status, 409);

    const grace = await register('Grace Hopper', 'grace@example.com', 'grace_hopper');

    const search = await send('GET', '/api/v1/users/search?q=grace', undefined, ada.accessToken);
    assert.equal(search.status, 200);
    const users = json<{ success: true; data: { users: { id: string; username: string | null }[] } }>(
      search,
    ).data.users;
    assert.ok(users.some((row) => row.id === grace.user.id));

    const body = JSON.stringify(search.body);
    assert.equal(body.includes('passwordHash'), false);

    const patched = await send(
      'PATCH',
      '/api/v1/users/me',
      { name: 'Ada L.', email: 'ada@example.com', username: 'ada_travel' },
      ada.accessToken,
    );
    assert.equal(patched.status, 200);
    const profile = json<{ success: true; data: { name: string; username: string } }>(patched).data;
    assert.equal(profile.name, 'Ada L.');
    assert.equal(profile.username, 'ada_travel');

    const selfAvailable = await send(
      'GET',
      '/api/v1/users/me/username-available?username=ada_travel',
      undefined,
      ada.accessToken,
    );
    assert.equal(
      json<{ success: true; data: { available: boolean } }>(selfAvailable).data.available,
      true,
    );
  });
});

async function register(name: string, email: string, username: string) {
  const response = await send('POST', '/api/v1/auth/register', { name, email, username, password });
  assert.equal(response.status, 201);
  return json<{
    success: true;
    data: { user: { id: string; username: string | null }; accessToken: string };
  }>(response).data;
}

async function send(method: string, path: string, body?: unknown, accessToken?: string) {
  const headers: Record<string, string> = { Origin: 'http://localhost:8081' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
}

function json<T>(response: { body: unknown }): T {
  return response.body as T;
}
