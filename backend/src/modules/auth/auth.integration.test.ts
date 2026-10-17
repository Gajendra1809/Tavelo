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
  data: {
    user: { id: string; name: string; email: string; username: string | null };
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
};

type ErrorBody = {
  success: false;
  error: { code: string; message: string };
};

type TripListBody = {
  success: true;
  data: { trips: { id: string; name: string; destination: string }[] };
};

type TripBody = {
  id: string;
  name: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  coverImageUrl: string | null;
  creatorId: string | null;
  creator: { id: string; name: string } | null;
  members: { userId: string; role: string; name: string }[];
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('authenticated trips', () => {

  before(async () => {
    memory = await MongoMemoryServer.create({
      binary: { checkMD5: false },
    });
    process.env.MONGODB_URI = memory.getUri();
    const { resetEnvCache } = await import('../../config/env');
    resetEnvCache();
    const { connectDatabase } = await import('../../config/database');
    await connectDatabase();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('The in-memory database did not connect.');
    }

    const { createApp } = await import('../../app');
    server = createServer(createApp());
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
    await memory.stop();
  });

  it('registers, signs in, isolates trips, rotates refresh tokens, and logs out', async () => {
    const ada = await register('Ada Lovelace', 'ada@example.com');
    const grace = await register('Grace Hopper', 'grace@example.com');

    const duplicate = await post('/api/v1/auth/register', {
      name: 'Ada Again',
      email: 'Ada@Example.com',
      username: uniqueTestUsername('ada-dup@example.com'),
      password,
    });
    assert.equal(duplicate.status, 409);
    assert.equal(json<ErrorBody>(duplicate).error.code, 'EMAIL_IN_USE');

    const duplicateUsername = await post('/api/v1/auth/register', {
      name: 'Username Clone',
      email: 'clone@example.com',
      username: ada.user.username,
      password,
    });
    assert.equal(duplicateUsername.status, 409);
    assert.equal(json<ErrorBody>(duplicateUsername).error.code, 'USERNAME_IN_USE');
    assert.equal(JSON.stringify(duplicate.body).toLowerCase().includes('passwordhash'), false);

    const badLogin = await post('/api/v1/auth/login', {
      email: 'ada@example.com',
      password: 'wrong-password-1',
    });
    const unknown = await post('/api/v1/auth/login', {
      email: 'missing@example.com',
      password: 'wrong-password-1',
    });
    assert.equal(badLogin.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(json<ErrorBody>(badLogin).error.message, json<ErrorBody>(unknown).error.message);

    const signedIn = await post('/api/v1/auth/login', {
      email: 'ada@example.com',
      password,
    });
    assert.equal(signedIn.status, 200);
    const session = json<SessionBody>(signedIn).data;
    assert.equal(session.user.email, 'ada@example.com');

    const signedInByUsername = await post('/api/v1/auth/login', {
      email: ada.user.username ?? '',
      password,
    });
    assert.equal(signedInByUsername.status, 200);
    assert.equal(json<SessionBody>(signedInByUsername).data.user.id, ada.user.id);
    assert.equal('passwordHash' in session.user, false);

    const created = await post(
      '/api/v1/trips',
      {
        name: 'Coast weekend',
        destination: 'Galle',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        description: 'Quiet days.',
      },
      ada.accessToken,
    );
    assert.equal(created.status, 201);
    const tripId = (created.body as { data: { id: string } }).data.id;

    const adaList = await get('/api/v1/trips', ada.accessToken);
    const graceList = await get('/api/v1/trips', grace.accessToken);
    assert.equal(json<TripListBody>(adaList).data.trips.some((trip) => trip.id === tripId), true);
    assert.equal(json<TripListBody>(graceList).data.trips.length, 0);

    const forbidden = await get(`/api/v1/trips/${tripId}`, grace.accessToken);
    assert.equal(forbidden.status, 403);
    assert.equal(json<ErrorBody>(forbidden).error.code, 'FORBIDDEN');

    const refreshed = await post('/api/v1/auth/refresh', { refreshToken: ada.refreshToken });
    assert.equal(refreshed.status, 200);
    const next = json<SessionBody>(refreshed).data;
    assert.notEqual(next.refreshToken, ada.refreshToken);
    assert.notEqual(next.accessToken, ada.accessToken);

    const reused = await post('/api/v1/auth/refresh', { refreshToken: ada.refreshToken });
    assert.equal(reused.status, 401);

    const afterReuse = await post('/api/v1/auth/refresh', { refreshToken: next.refreshToken });
    assert.equal(afterReuse.status, 401);

    const graceRefresh = await post('/api/v1/auth/refresh', { refreshToken: grace.refreshToken });
    assert.equal(graceRefresh.status, 200);
    const graceNext = json<SessionBody>(graceRefresh).data;
    const loggedOut = await post('/api/v1/auth/logout', { refreshToken: graceNext.refreshToken });
    assert.equal(loggedOut.status, 200);
    const afterLogout = await post('/api/v1/auth/refresh', { refreshToken: graceNext.refreshToken });
    assert.equal(afterLogout.status, 401);
  });

  it('creates, reads, updates, and deletes an owned trip', async () => {
    const owner = await register('Owner One', 'owner-one@example.com');
    const other = await register('Other Two', 'other-two@example.com');

    const invalidDates = await post(
      '/api/v1/trips',
      {
        name: 'Bad dates',
        destination: 'Colombo',
        startDate: '2026-12-10',
        endDate: '2026-12-01',
      },
      owner.accessToken,
    );
    assert.equal(invalidDates.status, 400);
    assert.equal(json<ErrorBody>(invalidDates).error.code, 'VALIDATION_ERROR');

    const invalidName = await post(
      '/api/v1/trips',
      {
        name: '   ',
        destination: 'Colombo',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
      },
      owner.accessToken,
    );
    assert.equal(invalidName.status, 400);

    const unauthenticated = await send('POST', '/api/v1/trips', {
      name: 'Hidden',
      destination: 'Kandy',
      startDate: '2026-12-01',
      endDate: '2026-12-02',
    });
    assert.equal(unauthenticated.status, 401);

    const created = await post(
      '/api/v1/trips',
      {
        name: 'Hill country',
        destination: 'Ella',
        startDate: '2026-12-02',
        endDate: '2026-12-05',
        description: 'Tea trails.',
        creatorId: other.user.id,
        ownerId: other.user.id,
        members: [],
      },
      owner.accessToken,
    );
    assert.equal(created.status, 201);
    const trip = json<{ success: true; data: TripBody }>(created).data;
    assert.equal(trip.name, 'Hill country');
    assert.equal(trip.title, 'Hill country');
    assert.equal(trip.destination, 'Ella');
    assert.equal(trip.startDate, '2026-12-02');
    assert.equal(trip.endDate, '2026-12-05');
    assert.equal(trip.description, 'Tea trails.');
    assert.equal(trip.coverImageUrl, null);
    assert.equal(trip.creatorId, owner.user.id);
    assert.equal(trip.creator?.name, 'Owner One');
    assert.equal(trip.members.length, 1);
    assert.equal(trip.members[0]?.role, 'owner');
    assert.equal(trip.members[0]?.userId, owner.user.id);

    const detail = await get(`/api/v1/trips/${trip.id}`, owner.accessToken);
    assert.equal(detail.status, 200);
    assert.equal(json<{ success: true; data: TripBody }>(detail).data.destination, 'Ella');

    const missing = await get('/api/v1/trips/000000000000000000000000', owner.accessToken);
    assert.equal(missing.status, 404);
    const invalidId = await get('/api/v1/trips/not-an-id', owner.accessToken);
    assert.equal(invalidId.status, 404);

    const otherView = await get(`/api/v1/trips/${trip.id}`, other.accessToken);
    assert.equal(otherView.status, 403);
    assert.equal(JSON.stringify(otherView.body).includes('Ella'), false);

    const otherEdit = await send(
      'PATCH',
      `/api/v1/trips/${trip.id}`,
      { name: 'Taken over' },
      other.accessToken,
    );
    assert.equal(otherEdit.status, 403);
    assert.equal(JSON.stringify(otherEdit.body).includes('Hill country'), false);

    const otherDelete = await send('DELETE', `/api/v1/trips/${trip.id}`, undefined, other.accessToken);
    assert.equal(otherDelete.status, 403);

    const stillThere = await get(`/api/v1/trips/${trip.id}`, owner.accessToken);
    assert.equal(stillThere.status, 200);
    assert.equal(json<{ success: true; data: TripBody }>(stillThere).data.name, 'Hill country');

    const badRange = await send(
      'PATCH',
      `/api/v1/trips/${trip.id}`,
      { endDate: '2026-12-01' },
      owner.accessToken,
    );
    assert.equal(badRange.status, 400);

    const emptyUpdate = await send('PATCH', `/api/v1/trips/${trip.id}`, {}, owner.accessToken);
    assert.equal(emptyUpdate.status, 400);

    const updated = await send(
      'PATCH',
      `/api/v1/trips/${trip.id}`,
      {
        name: 'Tea country',
        destination: 'Ella',
        description: 'Updated notes.',
      },
      owner.accessToken,
    );
    assert.equal(updated.status, 200);
    const updatedTrip = json<{ success: true; data: TripBody }>(updated).data;
    assert.equal(updatedTrip.name, 'Tea country');
    assert.equal(updatedTrip.coverImageUrl, null);
    assert.equal(updatedTrip.startDate, '2026-12-02');
    assert.equal(updatedTrip.creatorId, owner.user.id);

    const listed = await get('/api/v1/trips', owner.accessToken);
    assert.equal(
      json<TripListBody>(listed).data.trips.some((item) => item.id === trip.id && item.name === 'Tea country'),
      true,
    );

    const { TripModel } = await import('../trips/trip.model');
    const legacy = await TripModel.collection.insertOne({
      name: 'Old notes',
      destination: 'Kandy',
      startDate: new Date(Date.UTC(2026, 0, 2)),
      endDate: new Date(Date.UTC(2026, 0, 4)),
      ownerId: new mongoose.Types.ObjectId(owner.user.id),
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    const legacyView = await get(`/api/v1/trips/${String(legacy.insertedId)}`, owner.accessToken);
    assert.equal(legacyView.status, 200);
    const legacyTrip = json<{ success: true; data: TripBody }>(legacyView).data;
    assert.equal(legacyTrip.description, '');
    assert.equal(legacyTrip.coverImageUrl, null);
    assert.equal(legacyTrip.creatorId, owner.user.id);
    assert.equal(legacyTrip.members.length, 1);
    assert.equal(legacyTrip.members[0]?.role, 'owner');
    assert.equal(legacyTrip.members[0]?.name, 'Owner One');

    const noToken = await send('DELETE', `/api/v1/trips/${trip.id}`);
    assert.equal(noToken.status, 401);
    const noTokenRead = await send('GET', `/api/v1/trips/${trip.id}`);
    assert.equal(noTokenRead.status, 401);

    const removed = await send('DELETE', `/api/v1/trips/${trip.id}`, undefined, owner.accessToken);
    assert.equal(removed.status, 200);
    assert.equal(json<{ success: true; data: { deleted: boolean } }>(removed).data.deleted, true);

    const afterDelete = await get(`/api/v1/trips/${trip.id}`, owner.accessToken);
    assert.equal(afterDelete.status, 404);
    const listAfter = await get('/api/v1/trips', owner.accessToken);
    assert.equal(
      json<TripListBody>(listAfter).data.trips.some((item) => item.id === trip.id),
      false,
    );
    assert.equal(
      json<TripListBody>(listAfter).data.trips.some((item) => item.id === String(legacy.insertedId)),
      true,
    );
  });
});

async function register(name: string, email: string) {
  const username = uniqueTestUsername(email);
  const response = await post('/api/v1/auth/register', { name, email, username, password });
  assert.equal(response.status, 201);
  const body = json<SessionBody>(response);
  assert.equal(JSON.stringify(body).toLowerCase().includes('passwordhash'), false);
  assert.equal(body.data.user.email, email);
  return body.data;
}

async function post(path: string, body: unknown, accessToken?: string) {
  const headers: Record<string, string> = {
    Origin: 'http://localhost:8081',
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function get(path: string, accessToken: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Origin: 'http://localhost:8081',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return { status: response.status, body: await response.json() };
}

function json<T>(response: { body: unknown }): T {
  return response.body as T;
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
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
