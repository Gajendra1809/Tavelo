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

describe('trip bookings', () => {
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

  it('enforces membership, validation, and attachment rules', async () => {
    const stamp = Date.now();
    const owner = await register('Booking Owner', `book-owner-${stamp}@example.com`);
    const member = await register('Booking Member', `book-member-${stamp}@example.com`);
    const stranger = await register('Booking Stranger', `book-stranger-${stamp}@example.com`);
    const tripId = await createTrip(owner.accessToken);

    const invite = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: member.user.email },
      owner.accessToken,
    );
    const invitationId = json<{ success: true; data: { id: string } }>(invite).data.id;
    await send('POST', `/api/v1/invitations/${invitationId}/accept`, {}, member.accessToken);

    const denied = await send('GET', `/api/v1/trips/${tripId}/bookings`, undefined, stranger.accessToken);
    assert.equal(denied.status, 403);

    const invalid = await send(
      'POST',
      `/api/v1/trips/${tripId}/bookings`,
      { title: '', category: 'hotel', startDate: '2026-12-02' },
      member.accessToken,
    );
    assert.equal(invalid.status, 400);

    const created = await send(
      'POST',
      `/api/v1/trips/${tripId}/bookings`,
      {
        title: 'Rajanvansh Hotel',
        category: 'hotel',
        provider: 'Rajanvansh',
        startDate: '2026-12-02',
        endDate: '2026-12-03',
        location: 'Goa',
        bookingReference: 'HTL-123',
      },
      member.accessToken,
    );
    assert.equal(created.status, 201);
    const bookingId = json<{ success: true; data: { id: string; createdBy: { id: string } } }>(
      created,
    ).data.id;
    assert.equal(
      json<{ success: true; data: { createdBy: { id: string } } }>(created).data.createdBy.id,
      member.user.id,
    );

    const listed = await send('GET', `/api/v1/trips/${tripId}/bookings`, undefined, owner.accessToken);
    assert.equal(listed.status, 200);
    assert.equal(
      json<{ success: true; data: { total: number } }>(listed).data.total,
      1,
    );

    const uploadIntent = await send(
      'POST',
      `/api/v1/trips/${tripId}/bookings/${bookingId}/attachments/upload-intent`,
      { contentType: 'application/pdf', byteSize: 2048 },
      member.accessToken,
    );
    assert.equal(uploadIntent.status, 503);

    const { BookingModel } = await import('./booking.model');
    await BookingModel.updateOne(
      { _id: bookingId },
      {
        $push: {
          attachments: {
            objectKey: `trips/${tripId}/bookings/${bookingId}/confirm.pdf`,
            originalFilename: 'confirm.pdf',
            mimeType: 'application/pdf',
            byteSize: 2048,
            label: 'Confirmation',
            uploadedBy: new mongoose.Types.ObjectId(member.user.id),
            uploadedAt: new Date(),
          },
        },
      },
    );

    const detail = await send(
      'GET',
      `/api/v1/trips/${tripId}/bookings/${bookingId}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(detail.status, 200);
    assert.equal(
      json<{ success: true; data: { attachments: unknown[] } }>(detail).data.attachments.length,
      1,
    );

    const patchDenied = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/bookings/${bookingId}`,
      { title: 'Hacked' },
      stranger.accessToken,
    );
    assert.equal(patchDenied.status, 403);

    const patchOk = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/bookings/${bookingId}`,
      { notes: 'Updated by owner' },
      owner.accessToken,
    );
    assert.equal(patchOk.status, 200);

    const wrongTrip = await send(
      'GET',
      `/api/v1/trips/${new mongoose.Types.ObjectId().toString()}/bookings/${bookingId}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(wrongTrip.status, 404);

    const attachmentId = json<{ success: true; data: { attachments: { id: string }[] } }>(
      detail,
    ).data.attachments[0]?.id;
    assert.ok(attachmentId);

    const deleteAttachDenied = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/bookings/${bookingId}/attachments/${attachmentId}`,
      undefined,
      stranger.accessToken,
    );
    assert.equal(deleteAttachDenied.status, 403);

    const deleteAttach = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/bookings/${bookingId}/attachments/${attachmentId}`,
      undefined,
      member.accessToken,
    );
    assert.equal(deleteAttach.status, 200);

    const deleteBooking = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/bookings/${bookingId}`,
      undefined,
      member.accessToken,
    );
    assert.equal(deleteBooking.status, 200);
    assert.equal(await BookingModel.countDocuments({ tripId }), 0);
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
      name: 'Booking trip',
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
