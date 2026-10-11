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

type SessionBody = {
  success: true;
  data: { user: { id: string; name: string; email: string }; accessToken: string };
};

type ActivityBody = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('trip itinerary activities', () => {
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

  it('lets members collaborate and blocks strangers', async () => {
    const owner = await register('Owner Itin', 'owner-itin@example.com');
    const member = await register('Member Itin', 'member-itin@example.com');
    const stranger = await register('Stranger Itin', 'stranger-itin@example.com');
    const tripId = await createTrip(owner.accessToken, '2026-11-10', '2026-11-12');

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

    const blocked = await send('GET', `/api/v1/trips/${tripId}/activities`, undefined, stranger.accessToken);
    assert.equal(blocked.status, 403);

    const outside = await send(
      'POST',
      `/api/v1/trips/${tripId}/activities`,
      { title: 'Too early', date: '2026-11-09' },
      member.accessToken,
    );
    assert.equal(outside.status, 400);

    const badTime = await send(
      'POST',
      `/api/v1/trips/${tripId}/activities`,
      { title: 'Backwards', date: '2026-11-10', startTime: '15:00', endTime: '14:00' },
      owner.accessToken,
    );
    assert.equal(badTime.status, 400);

    const morning = await send(
      'POST',
      `/api/v1/trips/${tripId}/activities`,
      { title: 'Market', date: '2026-11-10', startTime: '09:00' },
      owner.accessToken,
    );
    assert.equal(morning.status, 201);
    const morningId = json<{ success: true; data: ActivityBody }>(morning).data.id;

    const flexible = await send(
      'POST',
      `/api/v1/trips/${tripId}/activities`,
      { title: 'Sunset', date: '2026-11-10' },
      member.accessToken,
    );
    assert.equal(flexible.status, 201);

    const afternoon = await send(
      'POST',
      `/api/v1/trips/${tripId}/activities`,
      { title: 'Fort', date: '2026-11-11', startTime: '14:00', endTime: '16:00' },
      member.accessToken,
    );
    assert.equal(afternoon.status, 201);
    const afternoonId = json<{ success: true; data: ActivityBody }>(afternoon).data.id;

    const dayList = await send(
      'GET',
      `/api/v1/trips/${tripId}/activities?date=2026-11-10`,
      undefined,
      member.accessToken,
    );
    assert.equal(dayList.status, 200);
    const dayActivities = json<{ success: true; data: { activities: ActivityBody[] } }>(dayList).data
      .activities;
    assert.deepEqual(
      dayActivities.map((activity) => activity.title),
      ['Market', 'Sunset'],
    );

    const all = await send('GET', `/api/v1/trips/${tripId}/activities`, undefined, owner.accessToken);
    const ordered = json<{ success: true; data: { activities: ActivityBody[] } }>(all).data.activities;
    assert.deepEqual(
      ordered.map((activity) => `${activity.date}:${activity.title}`),
      ['2026-11-10:Market', '2026-11-10:Sunset', '2026-11-11:Fort'],
    );

    const updated = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/activities/${afternoonId}`,
      { title: 'Fort walls' },
      member.accessToken,
    );
    assert.equal(updated.status, 200);
    assert.equal(json<{ success: true; data: ActivityBody }>(updated).data.title, 'Fort walls');

    const badId = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/activities/not-an-id`,
      { title: 'Nope' },
      owner.accessToken,
    );
    assert.equal(badId.status, 404);

    const strangerEdit = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/activities/${morningId}`,
      { title: 'Stolen' },
      stranger.accessToken,
    );
    assert.equal(strangerEdit.status, 403);

    const removed = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/activities/${morningId}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(removed.status, 200);

    const inviteStillWorks = await send(
      'GET',
      `/api/v1/trips/${tripId}/invitations`,
      undefined,
      owner.accessToken,
    );
    assert.equal(inviteStillWorks.status, 200);
  });

  it('deletes activities when the trip is deleted', async () => {
    const owner = await register('Owner Cleanup', 'owner-clean@example.com');
    const tripId = await createTrip(owner.accessToken, '2026-12-01', '2026-12-01');
    const created = await send(
      'POST',
      `/api/v1/trips/${tripId}/activities`,
      { title: 'Only plan', date: '2026-12-01' },
      owner.accessToken,
    );
    assert.equal(created.status, 201);
    const deletedTrip = await send('DELETE', `/api/v1/trips/${tripId}`, undefined, owner.accessToken);
    assert.equal(deletedTrip.status, 200);
    const list = await send('GET', `/api/v1/trips/${tripId}/activities`, undefined, owner.accessToken);
    assert.equal(list.status, 404);
  });
});

async function createTrip(accessToken: string, startDate: string, endDate: string) {
  const created = await send(
    'POST',
    '/api/v1/trips',
    {
      name: 'Coast path',
      destination: 'Galle',
      startDate,
      endDate,
      description: 'Shared plans',
    },
    accessToken,
  );
  assert.equal(created.status, 201);
  return json<{ success: true; data: { id: string } }>(created).data.id;
}

async function register(name: string, email: string) {
  const response = await send('POST', '/api/v1/auth/register', { name, email, password });
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
