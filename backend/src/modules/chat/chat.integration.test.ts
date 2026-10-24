import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { uniqueTestUsername } from '../../test/helpers.js';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.API_PREFIX = '/api/v1';
process.env.CORS_ORIGINS = 'http://localhost:8081';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-must-be-32-characters';

type SessionBody = {
  success: true;
  data: { user: { id: string; name: string; email: string }; accessToken: string };
};

type MessageRow = {
  id: string;
  body: string;
  deleted: boolean;
  mine: boolean;
  kind: string;
  sender: { id: string };
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('trip chat', () => {
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

  it('lets members exchange messages and blocks non-members', async () => {
    const owner = await register('Owner Chat', 'owner-chat@example.com');
    const member = await register('Member Chat', 'member-chat@example.com');
    const stranger = await register('Stranger Chat', 'stranger-chat@example.com');
    const tripId = await createTrip(owner.accessToken);
    await inviteAndAccept(tripId, owner, member);

    const blocked = await send(
      'GET',
      `/api/v1/trips/${tripId}/chat/messages`,
      undefined,
      stranger.accessToken,
    );
    assert.equal(blocked.status, 403);

    const blank = await send(
      'POST',
      `/api/v1/trips/${tripId}/chat/messages`,
      { body: '   ' },
      owner.accessToken,
    );
    assert.equal(blank.status, 400);

    const sent = await send(
      'POST',
      `/api/v1/trips/${tripId}/chat/messages`,
      { body: '  Beach or fort?  ', clientNonce: 'nonce-owner-1' },
      owner.accessToken,
    );
    assert.equal(sent.status, 201);
    const created = json<{ success: true; data: MessageRow }>(sent).data;
    assert.equal(created.body, 'Beach or fort?');
    assert.equal(created.mine, true);

    const replay = await send(
      'POST',
      `/api/v1/trips/${tripId}/chat/messages`,
      { body: 'Beach or fort?', clientNonce: 'nonce-owner-1' },
      owner.accessToken,
    );
    assert.equal(replay.status, 201);
    assert.equal(json<{ success: true; data: MessageRow }>(replay).data.id, created.id);

    const reply = await send(
      'POST',
      `/api/v1/trips/${tripId}/chat/messages`,
      { body: 'Fort first.' },
      member.accessToken,
    );
    assert.equal(reply.status, 201);

    const listed = await send(
      'GET',
      `/api/v1/trips/${tripId}/chat/messages`,
      undefined,
      member.accessToken,
    );
    assert.equal(listed.status, 200);
    const page = json<{
      success: true;
      data: { messages: MessageRow[]; olderCursor: string | null };
    }>(listed).data;
    assert.equal(page.messages.length, 2);
    assert.equal(page.messages[0]?.body, 'Beach or fort?');
    assert.equal(page.messages[1]?.body, 'Fort first.');

    const otherTrip = await createTrip(stranger.accessToken);
    const cross = await send(
      'GET',
      `/api/v1/trips/${otherTrip}/chat/messages`,
      undefined,
      member.accessToken,
    );
    assert.equal(cross.status, 403);

    const steal = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/chat/messages/${created.id}`,
      undefined,
      member.accessToken,
    );
    assert.equal(steal.status, 403);

    const removedOwn = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/chat/messages/${json<{ success: true; data: MessageRow }>(reply).data.id}`,
      undefined,
      member.accessToken,
    );
    assert.equal(removedOwn.status, 200);

    const afterDelete = await send(
      'GET',
      `/api/v1/trips/${tripId}/chat/messages`,
      undefined,
      owner.accessToken,
    );
    const remaining = json<{ success: true; data: { messages: MessageRow[] } }>(afterDelete).data
      .messages;
    assert.equal(remaining.some((row) => row.deleted && row.body === ''), true);
  });

  it('cuts off a removed member from trip chat', async () => {
    const owner = await register('Owner Leave', 'owner-leave-chat@example.com');
    const member = await register('Member Leave', 'member-leave-chat@example.com');
    const tripId = await createTrip(owner.accessToken);
    await inviteAndAccept(tripId, owner, member);

    const posted = await send(
      'POST',
      `/api/v1/trips/${tripId}/chat/messages`,
      { body: 'See you there' },
      member.accessToken,
    );
    assert.equal(posted.status, 201);

    const removed = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/members/${member.user.id}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(removed.status, 200);

    const blockedRead = await send(
      'GET',
      `/api/v1/trips/${tripId}/chat/messages`,
      undefined,
      member.accessToken,
    );
    assert.equal(blockedRead.status, 403);
    const blockedWrite = await send(
      'POST',
      `/api/v1/trips/${tripId}/chat/messages`,
      { body: 'Still here?' },
      member.accessToken,
    );
    assert.equal(blockedWrite.status, 403);

    const ownerStillSees = await send(
      'GET',
      `/api/v1/trips/${tripId}/chat/messages`,
      undefined,
      owner.accessToken,
    );
    assert.equal(ownerStillSees.status, 200);
    assert.equal(
      json<{ success: true; data: { messages: MessageRow[] } }>(ownerStillSees).data.messages.length,
      1,
    );

    const deletedTrip = await send('DELETE', `/api/v1/trips/${tripId}`, undefined, owner.accessToken);
    assert.equal(deletedTrip.status, 200);
    const { ChatMessageModel } = await import('./chat.model');
    assert.equal(await ChatMessageModel.countDocuments({ tripId }), 0);
  });
});

async function inviteAndAccept(
  tripId: string,
  owner: SessionBody['data'],
  member: SessionBody['data'],
) {
  const invite = await send(
    'POST',
    `/api/v1/trips/${tripId}/invitations`,
    { email: member.user.email },
    owner.accessToken,
  );
  assert.equal(invite.status, 201);
  const invitationId = json<{ success: true; data: { id: string } }>(invite).data.id;
  const accepted = await send(
    'POST',
    `/api/v1/invitations/${invitationId}/accept`,
    {},
    member.accessToken,
  );
  assert.equal(accepted.status, 200);
}

async function createTrip(accessToken: string) {
  const created = await send(
    'POST',
    '/api/v1/trips',
    {
      name: 'Goa crew',
      destination: 'Goa',
      startDate: '2026-12-01',
      endDate: '2026-12-08',
      description: 'Chat together',
    },
    accessToken,
  );
  assert.equal(created.status, 201);
  return json<{ success: true; data: { id: string } }>(created).data.id;
}

async function register(name: string, email: string) {
  const username = uniqueTestUsername(email);
  const response = await send('POST', '/api/v1/auth/register', { name, email, username, password });
  assert.equal(response.status, 201);
  return json<SessionBody>(response).data;
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
