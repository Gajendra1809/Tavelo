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

type GroupItem = {
  id: string;
  name: string;
  packed: boolean;
  owner: { id: string; name: string } | null;
};

type PersonalItem = {
  id: string;
  name: string;
  packed: boolean;
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('trip packing', () => {
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

  it('lets members share a group list and rejects invalid owners', async () => {
    const owner = await register('Owner Pack', 'owner-pack@example.com');
    const member = await register('Member Pack', 'member-pack@example.com');
    const stranger = await register('Stranger Pack', 'stranger-pack@example.com');
    const tripId = await createTrip(owner.accessToken);
    await inviteAndAccept(tripId, owner, member);

    const blocked = await send('GET', `/api/v1/trips/${tripId}/packing/group`, undefined, stranger.accessToken);
    assert.equal(blocked.status, 403);

    const blank = await send('POST', `/api/v1/trips/${tripId}/packing/group`, { name: '  ' }, owner.accessToken);
    assert.equal(blank.status, 400);

    const outsider = await send(
      'POST',
      `/api/v1/trips/${tripId}/packing/group`,
      { name: 'Adapter', ownerId: stranger.user.id },
      owner.accessToken,
    );
    assert.equal(outsider.status, 400);

    const created = await send(
      'POST',
      `/api/v1/trips/${tripId}/packing/group`,
      { name: '  Universal adapter ' },
      owner.accessToken,
    );
    assert.equal(created.status, 201);
    const createdItem = json<{ success: true; data: GroupItem }>(created).data;
    assert.equal(createdItem.name, 'Universal adapter');
    assert.equal(createdItem.packed, false);
    assert.equal(createdItem.owner, null);

    const listedByMember = await send(
      'GET',
      `/api/v1/trips/${tripId}/packing/group`,
      undefined,
      member.accessToken,
    );
    assert.equal(listedByMember.status, 200);
    const groupPayload = json<{
      success: true;
      data: { items: GroupItem[]; packedCount: number; total: number };
    }>(listedByMember).data;
    assert.equal(groupPayload.items.length, 1);
    assert.equal(groupPayload.items[0]?.id, createdItem.id);
    assert.equal(groupPayload.packedCount, 0);
    assert.equal(groupPayload.total, 1);

    const strangerMine = await send(
      'GET',
      `/api/v1/trips/${tripId}/packing/mine`,
      undefined,
      stranger.accessToken,
    );
    assert.equal(strangerMine.status, 403);

    const assigned = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/packing/group/${createdItem.id}`,
      { ownerId: member.user.id, packed: true },
      member.accessToken,
    );
    assert.equal(assigned.status, 200);
    const assignedItem = json<{ success: true; data: GroupItem }>(assigned).data;
    assert.equal(assignedItem.packed, true);
    assert.equal(assignedItem.owner?.id, member.user.id);

    const otherTrip = await createTrip(owner.accessToken);
    const foreign = await send(
      'PATCH',
      `/api/v1/trips/${otherTrip}/packing/group/${createdItem.id}`,
      { packed: false },
      owner.accessToken,
    );
    assert.equal(foreign.status, 404);

    const deleted = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/packing/group/${createdItem.id}`,
      undefined,
      member.accessToken,
    );
    assert.equal(deleted.status, 200);
    const afterDelete = await send(
      'GET',
      `/api/v1/trips/${tripId}/packing/group`,
      undefined,
      owner.accessToken,
    );
    assert.equal(json<{ success: true; data: { items: GroupItem[] } }>(afterDelete).data.items.length, 0);
  });

  it('keeps personal packing private even when another member has the id', async () => {
    const owner = await register('Owner Private', 'owner-priv@example.com');
    const member = await register('Member Private', 'member-priv@example.com');
    const tripId = await createTrip(owner.accessToken);
    await inviteAndAccept(tripId, owner, member);

    const mine = await send(
      'POST',
      `/api/v1/trips/${tripId}/packing/mine`,
      { name: 'Passport', userId: member.user.id },
      owner.accessToken,
    );
    assert.equal(mine.status, 201);
    const personal = json<{ success: true; data: PersonalItem }>(mine).data;
    assert.equal(personal.name, 'Passport');

    const ownerList = await send('GET', `/api/v1/trips/${tripId}/packing/mine`, undefined, owner.accessToken);
    assert.equal(ownerList.status, 200);
    assert.equal(json<{ success: true; data: { items: PersonalItem[] } }>(ownerList).data.items.length, 1);

    const memberList = await send('GET', `/api/v1/trips/${tripId}/packing/mine`, undefined, member.accessToken);
    assert.equal(memberList.status, 200);
    assert.equal(json<{ success: true; data: { items: PersonalItem[] } }>(memberList).data.items.length, 0);

    const stolenRead = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/packing/mine/${personal.id}`,
      { packed: true },
      member.accessToken,
    );
    assert.equal(stolenRead.status, 404);

    const stolenDelete = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/packing/mine/${personal.id}`,
      undefined,
      member.accessToken,
    );
    assert.equal(stolenDelete.status, 404);

    const stolenAsGroup = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/packing/group/${personal.id}`,
      { packed: true },
      member.accessToken,
    );
    assert.equal(stolenAsGroup.status, 404);

    const otherTrip = await createTrip(owner.accessToken);
    const otherList = await send(
      'GET',
      `/api/v1/trips/${otherTrip}/packing/mine`,
      undefined,
      owner.accessToken,
    );
    assert.equal(otherList.status, 200);
    assert.equal(json<{ success: true; data: { items: PersonalItem[] } }>(otherList).data.items.length, 0);

    const toggled = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/packing/mine/${personal.id}`,
      { packed: true, userId: member.user.id },
      owner.accessToken,
    );
    assert.equal(toggled.status, 200);
    assert.equal(json<{ success: true; data: PersonalItem }>(toggled).data.packed, true);

    const renamed = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/packing/mine/${personal.id}`,
      { name: 'Passport and visa' },
      owner.accessToken,
    );
    assert.equal(renamed.status, 200);
    assert.equal(json<{ success: true; data: PersonalItem }>(renamed).data.name, 'Passport and visa');

    const deletedMine = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/packing/mine/${personal.id}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(deletedMine.status, 200);
    const afterDelete = await send(
      'GET',
      `/api/v1/trips/${tripId}/packing/mine`,
      undefined,
      owner.accessToken,
    );
    assert.equal(json<{ success: true; data: { items: PersonalItem[] } }>(afterDelete).data.items.length, 0);
  });

  it('clears packing when a trip is deleted or a member is removed', async () => {
    const owner = await register('Owner Leave', 'owner-leave@example.com');
    const member = await register('Member Leave', 'member-leave@example.com');
    const tripId = await createTrip(owner.accessToken);
    await inviteAndAccept(tripId, owner, member);

    const group = await send(
      'POST',
      `/api/v1/trips/${tripId}/packing/group`,
      { name: 'First-aid kit', ownerId: member.user.id },
      owner.accessToken,
    );
    assert.equal(group.status, 201);
    const groupId = json<{ success: true; data: GroupItem }>(group).data.id;

    const personal = await send(
      'POST',
      `/api/v1/trips/${tripId}/packing/mine`,
      { name: 'Medication' },
      member.accessToken,
    );
    assert.equal(personal.status, 201);

    const removed = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/members/${member.user.id}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(removed.status, 200);

    const memberBlocked = await send(
      'GET',
      `/api/v1/trips/${tripId}/packing/mine`,
      undefined,
      member.accessToken,
    );
    assert.equal(memberBlocked.status, 403);

    const groupAfter = await send(
      'GET',
      `/api/v1/trips/${tripId}/packing/group`,
      undefined,
      owner.accessToken,
    );
    assert.equal(groupAfter.status, 200);
    const remainingGroup = json<{ success: true; data: { items: GroupItem[] } }>(groupAfter).data.items;
    assert.equal(remainingGroup[0]?.id, groupId);
    assert.equal(remainingGroup[0]?.owner, null);

    const { PackingItemModel } = await import('./packing.model');
    assert.equal(await PackingItemModel.countDocuments({ tripId, kind: 'personal' }), 0);

    const deletedTrip = await send('DELETE', `/api/v1/trips/${tripId}`, undefined, owner.accessToken);
    assert.equal(deletedTrip.status, 200);
    const gone = await send('GET', `/api/v1/trips/${tripId}/packing/group`, undefined, owner.accessToken);
    assert.equal(gone.status, 404);
    assert.equal(await PackingItemModel.countDocuments({ tripId }), 0);
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
      name: 'Hill station',
      destination: 'Ooty',
      startDate: '2026-12-01',
      endDate: '2026-12-05',
      description: 'Pack together',
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
