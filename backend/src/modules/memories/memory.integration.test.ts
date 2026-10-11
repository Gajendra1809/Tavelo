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
process.env.STORAGE_ENABLED = 'false';

type SessionBody = {
  success: true;
  data: { user: { id: string; name: string; email: string }; accessToken: string };
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('trip memories', () => {
  before(async () => {
    memory = await MongoMemoryServer.create({ binary: { checkMD5: false } });
    process.env.MONGODB_URI = memory.getUri();
    const { resetEnvCache } = await import('../../config/env');
    resetEnvCache();
    const { resetStorageConfigCache } = await import('../../config/storageEnv');
    resetStorageConfigCache();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
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

  it('enforces membership, captions, and deletion rules', async () => {
    const stamp = Date.now();
    const owner = await register('Memory Owner', `mem-owner-${stamp}@example.com`);
    const member = await register('Memory Member', `mem-member-${stamp}@example.com`);
    const stranger = await register('Memory Stranger', `mem-stranger-${stamp}@example.com`);
    const tripId = await createTrip(owner.accessToken);

    const invite = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: member.user.email },
      owner.accessToken,
    );
    const invitationId = json<{ success: true; data: { id: string } }>(invite).data.id;
    await send('POST', `/api/v1/invitations/${invitationId}/accept`, {}, member.accessToken);

    const denied = await send('GET', `/api/v1/trips/${tripId}/memories`, undefined, stranger.accessToken);
    assert.equal(denied.status, 403);

    const empty = await send('GET', `/api/v1/trips/${tripId}/memories`, undefined, member.accessToken);
    assert.equal(empty.status, 200);
    const emptyBody = json<{
      success: true;
      data: { items: unknown[]; total: number; photoCount: number; videoCount: number };
    }>(empty);
    assert.equal(emptyBody.data.total, 0);

    const uploadIntent = await send(
      'POST',
      `/api/v1/trips/${tripId}/memories/upload-intent`,
      { contentType: 'image/jpeg', byteSize: 1024 },
      member.accessToken,
    );
    assert.equal(uploadIntent.status, 503);

    const { MemoryModel } = await import('./memory.model');
    const doc = await MemoryModel.create({
      tripId: new mongoose.Types.ObjectId(tripId),
      uploadedBy: new mongoose.Types.ObjectId(member.user.id),
      mediaType: 'image',
      objectKey: `trips/${tripId}/media/test-photo.jpg`,
      mimeType: 'image/jpeg',
      byteSize: 1024,
      caption: 'Sunset',
    });

    const listed = await send('GET', `/api/v1/trips/${tripId}/memories`, undefined, owner.accessToken);
    assert.equal(listed.status, 200);
    const listBody = json<{
      success: true;
      data: { items: { id: string; caption: string }[]; total: number };
    }>(listed);
    assert.equal(listBody.data.total, 1);
    assert.equal(listBody.data.items[0]?.caption, 'Sunset');

    const patchDenied = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/memories/${doc._id.toString()}`,
      { caption: 'Hacked' },
      stranger.accessToken,
    );
    assert.equal(patchDenied.status, 403);

    const patchOk = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/memories/${doc._id.toString()}`,
      { caption: 'Updated by owner' },
      owner.accessToken,
    );
    assert.equal(patchOk.status, 200);

    const wrongTrip = await send(
      'PATCH',
      `/api/v1/trips/${new mongoose.Types.ObjectId().toString()}/memories/${doc._id.toString()}`,
      { caption: 'Nope' },
      owner.accessToken,
    );
    assert.equal(wrongTrip.status, 404);

    const deleteDenied = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/memories/${doc._id.toString()}`,
      undefined,
      stranger.accessToken,
    );
    assert.equal(deleteDenied.status, 403);

    const deleted = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/memories/${doc._id.toString()}`,
      undefined,
      member.accessToken,
    );
    assert.equal(deleted.status, 200);
    assert.equal(await MemoryModel.countDocuments({ tripId }), 0);
  });
});

async function register(name: string, email: string): Promise<SessionBody['data']> {
  const response = await send('POST', '/api/v1/auth/register', { name, email, password });
  assert.equal(response.status, 201);
  return json<SessionBody>(response).data;
}

async function createTrip(accessToken: string): Promise<string> {
  const response = await send(
    'POST',
    '/api/v1/trips',
    {
      name: 'Memory trip',
      destination: 'Goa',
      startDate: '2026-12-01',
      endDate: '2026-12-05',
      description: '',
    },
    accessToken,
  );
  assert.equal(response.status, 201);
  return json<{ success: true; data: { id: string } }>(response).data.id;
}

async function send(
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    parsed = JSON.parse(text) as unknown;
  }
  return { status: response.status, body: parsed };
}

function json<T>(response: { body: unknown }): T {
  return response.body as T;
}
