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

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('trip expenses', () => {
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
    if (mongoose.connection.readyState !== 1) {
      throw new Error('The in-memory database did not connect.');
    }
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

  it('supports splits, balances, settlements and keeps other modules working', async () => {
    const stamp = Date.now();
    const owner = await register('Owner Pay', `owner-pay-${stamp}@example.com`);
    const member = await register('Member Pay', `member-pay-${stamp}@example.com`);
    const stranger = await register('Stranger Pay', `stranger-pay-${stamp}@example.com`);
    const tripId = await createTrip(owner.accessToken);

    const invite = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: member.user.email },
      owner.accessToken,
    );
    if (invite.status !== 201) {
      throw new Error(`Invite failed: ${invite.status} ${JSON.stringify(invite.body)}`);
    }
    const invitationId = json<{ success: true; data: { id: string } }>(invite).data.id;
    const accepted = await send('POST', `/api/v1/invitations/${invitationId}/accept`, {}, member.accessToken);
    assert.equal(accepted.status, 200);

    const denied = await send('GET', `/api/v1/trips/${tripId}/expenses`, undefined, stranger.accessToken);
    assert.equal(denied.status, 403);

    const badParticipant = await send(
      'POST',
      `/api/v1/trips/${tripId}/expenses`,
      {
        description: 'Lunch',
        amountMinor: 300,
        category: 'food',
        paidBy: owner.user.id,
        expenseDate: '2026-11-10',
        splitMethod: 'equal',
        participantIds: [owner.user.id, stranger.user.id],
      },
      owner.accessToken,
    );
    assert.equal(badParticipant.status, 400);

    const created = await send(
      'POST',
      `/api/v1/trips/${tripId}/expenses`,
      {
        description: 'Tuk ride',
        amountMinor: 100,
        category: 'transport',
        paidBy: owner.user.id,
        expenseDate: '2026-11-10',
        splitMethod: 'equal',
        participantIds: [owner.user.id, member.user.id],
      },
      owner.accessToken,
    );
    if (created.status !== 201) {
      throw new Error(`Create expense failed: ${created.status} ${JSON.stringify(created.body)}`);
    }
    const expenseId = json<{ success: true; data: { id: string } }>(created).data.id;

    const custom = await send(
      'POST',
      `/api/v1/trips/${tripId}/expenses`,
      {
        description: 'Market',
        amountMinor: 500,
        category: 'shopping',
        paidBy: member.user.id,
        expenseDate: '2026-11-11',
        splitMethod: 'custom',
        shares: [
          { userId: owner.user.id, amountMinor: 500 },
        ],
      },
      member.accessToken,
    );
    assert.equal(custom.status, 201);

    const balances = json<{
      success: true;
      data: { balances: { userId: string; netMinor: number; currency: string }[] };
    }>(await send('GET', `/api/v1/trips/${tripId}/expenses/balances`, undefined, member.accessToken));
    const ownerInr = balances.data.balances.find(
      (row) => row.userId === owner.user.id && row.currency === 'INR',
    );
    const memberInr = balances.data.balances.find(
      (row) => row.userId === member.user.id && row.currency === 'INR',
    );
    assert.ok(ownerInr && memberInr);
    assert.equal(ownerInr.netMinor, -450);
    assert.equal(memberInr.netMinor, 450);

    const suggestions = json<{
      success: true;
      data: { suggestions: { fromUserId: string; toUserId: string; amountMinor: number }[] };
    }>(
      await send(
        'GET',
        `/api/v1/trips/${tripId}/expenses/settlement-suggestions`,
        undefined,
        owner.accessToken,
      ),
    );
    assert.ok(suggestions.data.suggestions.length >= 1);

    const tooMuch = await send(
      'POST',
      `/api/v1/trips/${tripId}/settlements`,
      {
        payerId: owner.user.id,
        recipientId: member.user.id,
        amountMinor: 999_999,
        currency: 'INR',
      },
      member.accessToken,
    );
    assert.equal(tooMuch.status, 400);

    const bystander = await register('Bystander Pay', `bystander-pay-${stamp}@example.com`);
    const inviteBystander = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: bystander.user.email },
      owner.accessToken,
    );
    assert.equal(inviteBystander.status, 201);
    const bystanderInviteId = json<{ success: true; data: { id: string } }>(inviteBystander).data.id;
    assert.equal(
      (await send('POST', `/api/v1/invitations/${bystanderInviteId}/accept`, {}, bystander.accessToken))
        .status,
      200,
    );

    const outsiderRecord = await send(
      'POST',
      `/api/v1/trips/${tripId}/settlements`,
      {
        payerId: owner.user.id,
        recipientId: member.user.id,
        amountMinor: 50,
        currency: 'INR',
      },
      bystander.accessToken,
    );
    assert.equal(outsiderRecord.status, 403);

    const settlement = await send(
      'POST',
      `/api/v1/trips/${tripId}/settlements`,
      {
        payerId: owner.user.id,
        recipientId: member.user.id,
        amountMinor: 50,
        currency: 'INR',
        note: 'Cash',
      },
      member.accessToken,
    );
    assert.equal(settlement.status, 201);
    const settlementId = json<{ success: true; data: { id: string } }>(settlement).data.id;

    const locked = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/expenses/${expenseId}`,
      { description: 'Changed' },
      owner.accessToken,
    );
    assert.equal(locked.status, 409);

    const itinerary = await send(
      'POST',
      `/api/v1/trips/${tripId}/activities`,
      { title: 'Walk', date: '2026-11-10' },
      member.accessToken,
    );
    assert.equal(itinerary.status, 201);

    const cancelled = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/settlements/${settlementId}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(cancelled.status, 200);

    const edited = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/expenses/${expenseId}`,
      { description: 'Tuk ride updated' },
      owner.accessToken,
    );
    assert.equal(edited.status, 200);

    const strangerEdit = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/expenses/${expenseId}`,
      undefined,
      stranger.accessToken,
    );
    assert.equal(strangerEdit.status, 403);
  });
});

async function createTrip(accessToken: string) {
  const created = await send(
    'POST',
    '/api/v1/trips',
    {
      name: 'Coast path',
      destination: 'Galle',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      description: 'Shared costs',
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
