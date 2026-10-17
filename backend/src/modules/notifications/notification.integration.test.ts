import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { uniqueTestUsername } from '../../test/helpers.js';
import { NotificationModel } from './notification.model';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.API_PREFIX = '/api/v1';
process.env.CORS_ORIGINS = 'http://localhost:8081';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-must-be-32-characters';

type SessionBody = {
  success: true;
  data: { user: { id: string; name: string; email: string }; accessToken: string };
};

type NotificationRow = {
  id: string;
  type: string;
  message: string;
  readAt: string | null;
  entityLabel: string;
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('in-app notifications', () => {
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
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
    await memory.stop();
  });

  it('covers invitation, booking, expense, settlement rules and access control', async () => {
    const stamp = Date.now();
    const owner = await register('Owner Notify', `owner-notify-${stamp}@example.com`);
    const member = await register('Member Notify', `member-notify-${stamp}@example.com`);
    const friend = await register('Friend Notify', `friend-notify-${stamp}@example.com`);
    const stranger = await register('Stranger Notify', `stranger-notify-${stamp}@example.com`);

    const tripId = await createTrip(owner.accessToken);
    const inviteRes = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: member.user.email },
      owner.accessToken,
    );
    assert.equal(inviteRes.status, 201);
    const invitationId = json<{ success: true; data: { id: string } }>(inviteRes).data.id;

    const failedInvite = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: 'missing-notify@example.com' },
      owner.accessToken,
    );
    assert.equal(failedInvite.status, 404);
    const beforeFailCount = await NotificationModel.countDocuments({ recipientId: owner.user.id });
    assert.equal(beforeFailCount, 0);

    let memberInbox = await listNotifications(member.accessToken);
    assert.equal(memberInbox.notifications.some((row) => row.type === 'trip_invitation'), true);
    assert.equal(
      memberInbox.notifications.filter((row) => row.type === 'trip_invitation').length,
      1,
    );

    const duplicateInvite = await send(
      'POST',
      `/api/v1/trips/${tripId}/invitations`,
      { email: member.user.email },
      owner.accessToken,
    );
    assert.equal(duplicateInvite.status, 409);
    memberInbox = await listNotifications(member.accessToken);
    assert.equal(
      memberInbox.notifications.filter((row) => row.type === 'trip_invitation').length,
      1,
    );

    const accept = await send('POST', `/api/v1/invitations/${invitationId}/accept`, {}, member.accessToken);
    assert.equal(accept.status, 200);

    const bookingCreated = await send(
      'POST',
      `/api/v1/trips/${tripId}/bookings`,
      {
        title: 'Rajanvansh Hotel',
        category: 'hotel',
        startDate: '2026-11-10',
      },
      owner.accessToken,
    );
    assert.equal(bookingCreated.status, 201);
    const bookingId = json<{ success: true; data: { id: string } }>(bookingCreated).data.id;

    memberInbox = await listNotifications(member.accessToken);
    const bookingNotice = memberInbox.notifications.find((row) => row.type === 'booking_created');
    assert.ok(bookingNotice);
    assert.match(bookingNotice!.message, /Rajanvansh Hotel/);

    const ownerInboxAfterBooking = await listNotifications(owner.accessToken);
    assert.equal(
      ownerInboxAfterBooking.notifications.some((row) => row.type === 'booking_created'),
      false,
    );

    const bookingUpdated = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/bookings/${bookingId}`,
      { title: 'Updated Hotel Name' },
      owner.accessToken,
    );
    assert.equal(bookingUpdated.status, 200);
    memberInbox = await listNotifications(member.accessToken);
    assert.equal(
      memberInbox.notifications.filter((row) => row.type === 'booking_updated').length,
      1,
    );

    const bookingDeleted = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/bookings/${bookingId}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(bookingDeleted.status, 200);
    memberInbox = await listNotifications(member.accessToken);
    const deletedNotice = memberInbox.notifications.find((row) => row.type === 'booking_deleted');
    assert.ok(deletedNotice);
    assert.equal(deletedNotice!.entityLabel, 'Updated Hotel Name');

    const expenseCreated = await send(
      'POST',
      `/api/v1/trips/${tripId}/expenses`,
      {
        description: 'Hotel payment',
        amountMinor: 5000,
        category: 'lodging',
        paidBy: owner.user.id,
        expenseDate: '2026-11-10',
        splitMethod: 'equal',
        participantIds: [owner.user.id, member.user.id],
      },
      owner.accessToken,
    );
    assert.equal(expenseCreated.status, 201);
    const expenseId = json<{ success: true; data: { id: string } }>(expenseCreated).data.id;

    memberInbox = await listNotifications(member.accessToken);
    assert.equal(
      memberInbox.notifications.some((row) => row.type === 'expense_created' && row.message.includes('Hotel payment')),
      true,
    );
    const friendInbox = await listNotifications(friend.accessToken);
    assert.equal(friendInbox.notifications.length, 0);

    const expenseDeleted = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/expenses/${expenseId}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(expenseDeleted.status, 200);
    memberInbox = await listNotifications(member.accessToken);
    const expenseDeleteNotice = memberInbox.notifications.find((row) => row.type === 'expense_deleted');
    assert.ok(expenseDeleteNotice);
    assert.match(expenseDeleteNotice!.message, /Hotel payment/);

    const expenseUpdatedSetup = await send(
      'POST',
      `/api/v1/trips/${tripId}/expenses`,
      {
        description: 'Train tickets',
        amountMinor: 3000,
        category: 'transport',
        paidBy: owner.user.id,
        expenseDate: '2026-11-10',
        splitMethod: 'equal',
        participantIds: [owner.user.id, member.user.id],
      },
      owner.accessToken,
    );
    assert.equal(expenseUpdatedSetup.status, 201);
    const expenseForUpdate = json<{ success: true; data: { id: string } }>(expenseUpdatedSetup).data.id;

    const expenseUpdated = await send(
      'PATCH',
      `/api/v1/trips/${tripId}/expenses/${expenseForUpdate}`,
      {
        participantIds: [owner.user.id],
        splitMethod: 'equal',
        amountMinor: 3000,
      },
      owner.accessToken,
    );
    assert.equal(expenseUpdated.status, 200);
    memberInbox = await listNotifications(member.accessToken);
    assert.equal(
      memberInbox.notifications.some((row) => row.type === 'expense_updated'),
      true,
    );

    const expense2 = await send(
      'POST',
      `/api/v1/trips/${tripId}/expenses`,
      {
        description: 'Dinner',
        amountMinor: 2000,
        category: 'food',
        paidBy: member.user.id,
        expenseDate: '2026-11-10',
        splitMethod: 'equal',
        participantIds: [owner.user.id, member.user.id],
      },
      member.accessToken,
    );
    assert.equal(expense2.status, 201);

    const settlement = await send(
      'POST',
      `/api/v1/trips/${tripId}/settlements`,
      {
        payerId: owner.user.id,
        recipientId: member.user.id,
        amountMinor: 1000,
        currency: 'INR',
      },
      member.accessToken,
    );
    assert.equal(settlement.status, 201);
    const settlementId = json<{ success: true; data: { id: string } }>(settlement).data.id;

    const ownerSettlementInbox = await listNotifications(owner.accessToken);
    assert.equal(
      ownerSettlementInbox.notifications.some((row) => row.type === 'settlement_recorded'),
      true,
    );
    const memberSettlementInbox = await listNotifications(member.accessToken);
    assert.equal(
      memberSettlementInbox.notifications.some((row) => row.type === 'settlement_recorded'),
      false,
    );

    const cancelSettlement = await send(
      'DELETE',
      `/api/v1/trips/${tripId}/settlements/${settlementId}`,
      undefined,
      owner.accessToken,
    );
    assert.equal(cancelSettlement.status, 200);
    const ownerAfterCancel = await listNotifications(owner.accessToken);
    assert.equal(
      ownerAfterCancel.notifications.some((row) => row.type === 'settlement_cancelled'),
      false,
    );
    const memberAfterCancelNotify = await listNotifications(member.accessToken);
    assert.equal(
      memberAfterCancelNotify.notifications.some((row) => row.type === 'settlement_cancelled'),
      true,
    );

    const unread = await send('GET', '/api/v1/notifications/unread-count', undefined, member.accessToken);
    assert.equal(unread.status, 200);
    const unreadCount = json<{ success: true; data: { count: number } }>(unread).data.count;
    assert.ok(unreadCount > 0);

    const markAll = await send('PATCH', '/api/v1/notifications/read-all', {}, member.accessToken);
    assert.equal(markAll.status, 200);
    const unreadAfter = await send('GET', '/api/v1/notifications/unread-count', undefined, member.accessToken);
    assert.equal(json<{ success: true; data: { count: number } }>(unreadAfter).data.count, 0);

    const foreignRead = await send(
      'PATCH',
      `/api/v1/notifications/${memberInbox.notifications[0]?.id}/read`,
      {},
      stranger.accessToken,
    );
    assert.equal(foreignRead.status, 403);

    const strangerList = await send('GET', '/api/v1/notifications', undefined, stranger.accessToken);
    assert.equal(strangerList.status, 200);
    assert.equal(json<{ success: true; data: { notifications: NotificationRow[] } }>(strangerList).data.notifications.length, 0);
  });
});

async function listNotifications(accessToken: string) {
  const response = await send('GET', '/api/v1/notifications?limit=50', undefined, accessToken);
  assert.equal(response.status, 200);
  return json<{ success: true; data: { notifications: NotificationRow[]; nextCursor: string | null } }>(
    response,
  ).data;
}

async function createTrip(accessToken: string) {
  const created = await send(
    'POST',
    '/api/v1/trips',
    {
      name: 'Notify Trip',
      destination: 'Galle',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      description: 'Notifications test',
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
