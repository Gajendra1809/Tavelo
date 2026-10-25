import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { uniqueTestUsername } from '../../test/helpers.js';
import { PushDeviceModel } from './pushDevice.model';
import { setPushTransportForTests, type ExpoPushMessage } from './push.service';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.API_PREFIX = '/api/v1';
process.env.CORS_ORIGINS = 'http://localhost:8081';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-must-be-32-characters';

type SessionBody = {
  success: true;
  data: { user: { id: string }; accessToken: string };
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;
const sent: ExpoPushMessage[][] = [];

describe('push device registration', () => {
  before(async () => {
    memory = await MongoMemoryServer.create({ binary: { checkMD5: false } });
    process.env.MONGODB_URI = memory.getUri();
    const { resetEnvCache } = await import('../../config/env');
    resetEnvCache();
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
    setPushTransportForTests(async (messages) => {
      sent.push(messages);
      return messages.map((message) =>
        message.to.includes('gone')
          ? { status: 'error' as const, details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok' as const, id: 'ticket' },
      );
    });
  });

  after(async () => {
    setPushTransportForTests(null);
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
    await memory.stop();
  });

  it('requires auth, stores multiple devices, refreshes a token, and blocks another user from removing it', async () => {
    const owner = await register('Owner Push', 'owner-push@example.com');
    const member = await register('Member Push', 'member-push@example.com');
    const anonymous = await send('POST', '/api/v1/notifications/devices', {
      token: 'ExponentPushToken[phone]',
    });
    assert.equal(anonymous.status, 401);

    const phone = await send(
      'POST',
      '/api/v1/notifications/devices',
      { token: 'ExponentPushToken[phone]', platform: 'android' },
      owner.accessToken,
    );
    assert.equal(phone.status, 200);
    const tablet = await send(
      'POST',
      '/api/v1/notifications/devices',
      { token: 'ExponentPushToken[tablet]', platform: 'android' },
      owner.accessToken,
    );
    assert.equal(tablet.status, 200);
    assert.equal(await PushDeviceModel.countDocuments({ userId: owner.user.id, active: true }), 2);

    const beforeRefresh = await PushDeviceModel.findOne({ token: 'ExponentPushToken[phone]' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const refreshed = await send(
      'POST',
      '/api/v1/notifications/devices',
      { token: 'ExponentPushToken[phone]', platform: 'android' },
      owner.accessToken,
    );
    assert.equal(refreshed.status, 200);
    const afterRefresh = await PushDeviceModel.findOne({ token: 'ExponentPushToken[phone]' });
    assert.ok(afterRefresh && beforeRefresh);
    assert.ok(afterRefresh.lastSeenAt.getTime() >= beforeRefresh.lastSeenAt.getTime());
    assert.equal(await PushDeviceModel.countDocuments({ token: 'ExponentPushToken[phone]' }), 1);

    const stolen = await send(
      'DELETE',
      '/api/v1/notifications/devices',
      { token: 'ExponentPushToken[phone]' },
      member.accessToken,
    );
    assert.equal(stolen.status, 404);
    assert.equal(
      (await PushDeviceModel.findOne({ token: 'ExponentPushToken[phone]' }))?.active,
      true,
    );

    const moved = await send(
      'POST',
      '/api/v1/notifications/devices',
      { token: 'ExponentPushToken[phone]', platform: 'android' },
      member.accessToken,
    );
    assert.equal(moved.status, 200);
    const movedDevice = await PushDeviceModel.findOne({ token: 'ExponentPushToken[phone]' });
    assert.equal(movedDevice?.userId.toString(), member.user.id);
    assert.equal(movedDevice?.active, true);
  });

  it('pushes only to other members, skips duplicate alerts, and deactivates an invalid token', async () => {
    sent.length = 0;
    const owner = await register('Owner Alert', 'owner-alert@example.com');
    const member = await register('Member Alert', 'member-alert@example.com');
    await send(
      'POST',
      '/api/v1/notifications/devices',
      { token: 'ExponentPushToken[owner-alert]', platform: 'android' },
      owner.accessToken,
    );
    await send(
      'POST',
      '/api/v1/notifications/devices',
      { token: 'ExponentPushToken[member-alert]', platform: 'android' },
      member.accessToken,
    );
    await send(
      'POST',
      '/api/v1/notifications/devices',
      { token: 'ExponentPushToken[gone]', platform: 'android' },
      member.accessToken,
    );

    const tripId = await createTrip(owner.accessToken);
    const invite = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: member.user.email },
      owner.accessToken,
    );
    assert.equal(invite.status, 201);
    const again = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: member.user.email },
      owner.accessToken,
    );
    assert.notEqual(again.status, 201);

    const deliveredTo = sent.flat().map((message) => message.to);
    assert.equal(deliveredTo.includes('ExponentPushToken[owner-alert]'), false);
    assert.equal(deliveredTo.filter((token) => token === 'ExponentPushToken[member-alert]').length, 1);
    assert.equal(
      (await PushDeviceModel.findOne({ token: 'ExponentPushToken[gone]' }))?.active,
      false,
    );
    assert.equal(sent.flat()[0]?.data.type, 'trip_invitation');
    assert.equal(sent.flat()[0]?.data.tripId, tripId);

    const loggedOut = await send(
      'DELETE',
      '/api/v1/notifications/devices',
      { token: 'ExponentPushToken[member-alert]' },
      member.accessToken,
    );
    assert.equal(loggedOut.status, 200);
    assert.equal(
      (await PushDeviceModel.findOne({ token: 'ExponentPushToken[member-alert]' }))?.active,
      false,
    );
  });
});

async function createTrip(accessToken: string) {
  const created = await send(
    'POST',
    '/api/v1/trips',
    {
      name: 'Push trip',
      destination: 'Goa',
      startDate: '2026-12-01',
      endDate: '2026-12-08',
      description: 'Alerts',
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
  const body = json<SessionBody>(response).data;
  return { ...body, user: { ...body.user, email } };
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
