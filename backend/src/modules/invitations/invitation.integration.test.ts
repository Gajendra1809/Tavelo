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

type InvitationBody = {
  id: string;
  status: string;
  trip?: { id: string; name: string; destination: string };
  invitee?: { id: string; email: string };
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('trip invitations', () => {
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

  it('invites, accepts, and keeps existing trip access working', async () => {
    const owner = await register('Owner One', 'owner-invite@example.com');
    const friend = await register('Friend Two', 'friend-invite@example.com');
    const stranger = await register('Stranger Three', 'stranger-invite@example.com');
    const tripId = await createTrip(owner.accessToken);

    const updated = await send(
      'PATCH',
      `/api/v1/trips/${tripId}`,
      { description: 'Still editable.' },
      owner.accessToken,
    );
    assert.equal(updated.status, 200);

    const unknown = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: 'missing-invite@example.com' },
      owner.accessToken,
    );
    assert.equal(unknown.status, 404);

    const self = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: owner.user.email },
      owner.accessToken,
    );
    assert.equal(self.status, 400);

    const invited = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: 'Friend-Invite@Example.com', userId: stranger.user.id, status: 'accepted' },
      owner.accessToken,
    );
    assert.equal(invited.status, 201);
    const invitation = json<{ success: true; data: InvitationBody }>(invited).data;
    assert.equal(invitation.invitee?.email, 'friend-invite@example.com');
    assert.equal(invitation.status, 'pending');
    assert.equal(JSON.stringify(invited.body).toLowerCase().includes('passwordhash'), false);

    const duplicate = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: friend.user.email },
      owner.accessToken,
    );
    assert.equal(duplicate.status, 409);

    const strangerInvite = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: stranger.user.email },
      stranger.accessToken,
    );
    assert.equal(strangerInvite.status, 403);
    assert.equal(JSON.stringify(strangerInvite.body).includes('Quiet coast'), false);

    const inbox = await send('GET', '/api/v1/invitations', undefined, friend.accessToken);
    assert.equal(inbox.status, 200);
    const received = json<{ success: true; data: { invitations: InvitationBody[] } }>(inbox).data
      .invitations;
    assert.equal(received.length, 1);
    assert.equal(received[0]?.trip?.name, 'Coast path');
    assert.equal(received[0]?.trip?.destination, 'Galle');
    assert.equal(JSON.stringify(inbox.body).includes('Quiet coast'), false);

    const stolen = await send(
      'POST',
      `/api/v1/invitations/${invitation.id}/accept`,
      {},
      stranger.accessToken,
    );
    assert.equal(stolen.status, 403);
    const friendStillOut = await send('GET', `/api/v1/trips/${tripId}`, undefined, friend.accessToken);
    assert.equal(friendStillOut.status, 403);

    const [first, second] = await Promise.all([
      send('POST', `/api/v1/invitations/${invitation.id}/accept`, {}, friend.accessToken),
      send('POST', `/api/v1/invitations/${invitation.id}/accept`, {}, friend.accessToken),
    ]);
    const statuses = [first.status, second.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    const joined = await send('GET', `/api/v1/trips/${tripId}`, undefined, friend.accessToken);
    assert.equal(joined.status, 200);
    const members = json<{ success: true; data: { members: { userId: string; role: string }[] } }>(
      joined,
    ).data.members;
    assert.equal(members.filter((member) => member.userId === friend.user.id).length, 1);
    assert.equal(members.some((member) => member.role === 'owner' && member.userId === owner.user.id), true);

    const friendList = await send('GET', '/api/v1/trips', undefined, friend.accessToken);
    assert.equal(
      json<{ success: true; data: { trips: { id: string }[] } }>(friendList).data.trips.some(
        (trip) => trip.id === tripId,
      ),
      true,
    );

    const already = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: friend.user.email },
      owner.accessToken,
    );
    assert.equal(already.status, 409);

    const removeOwner = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/members/${owner.user.id}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(removeOwner.status, 403);
    const friendRemove = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/members/${friend.user.id}`,
      undefined,
      friend.accessToken,
    );
    assert.equal(friendRemove.status, 403);

    const removed = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/members/${friend.user.id}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(removed.status, 200);
    const afterRemove = await send('GET', `/api/v1/trips/${tripId}`, undefined, friend.accessToken);
    assert.equal(afterRemove.status, 403);

    const noToken = await send('GET', '/api/v1/invitations');
    assert.equal(noToken.status, 401);
  });

  it('lets the recipient decline and the owner cancel without granting access', async () => {
    const owner = await register('Owner Four', 'owner-decline@example.com');
    const friend = await register('Friend Five', 'friend-decline@example.com');
    const other = await register('Other Six', 'other-decline@example.com');
    const tripId = await createTrip(owner.accessToken, 'Hill path');

    const invited = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: friend.user.email },
      owner.accessToken,
    );
    const invitationId = json<{ success: true; data: InvitationBody }>(invited).data.id;

    const declinedByOther = await send(
      'POST',
      `/api/v1/invitations/${invitationId}/decline`,
      {},
      other.accessToken,
    );
    assert.equal(declinedByOther.status, 403);

    const declined = await send(
      'POST',
      `/api/v1/invitations/${invitationId}/decline`,
      {},
      friend.accessToken,
    );
    assert.equal(declined.status, 200);
    const noAccess = await send('GET', `/api/v1/trips/${tripId}`, undefined, friend.accessToken);
    assert.equal(noAccess.status, 403);
    const answered = await send(
      'POST',
      `/api/v1/invitations/${invitationId}/accept`,
      {},
      friend.accessToken,
    );
    assert.equal(answered.status, 409);

    const second = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: other.user.email },
      owner.accessToken,
    );
    const secondId = json<{ success: true; data: InvitationBody }>(second).data.id;
    const cancelled = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/invitations/${secondId}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(cancelled.status, 200);
    const lateAccept = await send(
      'POST',
      `/api/v1/invitations/${secondId}/accept`,
      {},
      other.accessToken,
    );
    assert.equal(lateAccept.status, 404);

    const deleted = await send('DELETE', `/api/v1/trips/${tripId}`, undefined, owner.accessToken);
    assert.equal(deleted.status, 200);
    const gone = await send('GET', `/api/v1/trips/${tripId}`, undefined, owner.accessToken);
    assert.equal(gone.status, 404);
  });
});

async function createTrip(accessToken: string, name = 'Coast path') {
  const created = await send(
    'POST',
    '/api/v1/trips',
    {
      name,
      destination: 'Galle',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      description: 'Quiet coast',
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
