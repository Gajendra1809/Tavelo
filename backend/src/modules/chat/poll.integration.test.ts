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

type PollRow = {
  id: string;
  question: string;
  anonymous: boolean;
  status: string;
  votedCount: number;
  ownOptionIds: string[];
  options: { id: string; label: string; voteCount: number; voters: { id: string }[] | null }[];
  result: { kind: string; optionIds: string[] };
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;

describe('trip decision polls', () => {
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

  it('lets members create, vote, change votes, and rejects invalid polls', async () => {
    const owner = await register('Owner Poll', 'owner-poll@example.com');
    const member = await register('Member Poll', 'member-poll@example.com');
    const stranger = await register('Stranger Poll', 'stranger-poll@example.com');
    const tripId = await createTrip(owner.accessToken);
    await inviteAndAccept(tripId, owner, member);

    const invalid = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls`,
      { question: 'Where?', options: [{ label: 'Only one' }] },
      owner.accessToken,
    );
    assert.equal(invalid.status, 400);

    const created = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls`,
      {
        question: 'Which hotel should we book?',
        category: 'hotel',
        options: [{ label: 'Taj' }, { label: 'Marriott' }],
      },
      owner.accessToken,
    );
    assert.equal(created.status, 201);
    const poll = json<{ success: true; data: PollRow }>(created).data;
    const taj = poll.options.find((option) => option.label === 'Taj')?.id;
    const marriott = poll.options.find((option) => option.label === 'Marriott')?.id;
    assert.ok(taj && marriott);

    const chat = await send(
      'GET',
      `/api/v1/trips/${tripId}/chat/messages`,
      undefined,
      member.accessToken,
    );
    assert.equal(chat.status, 200);
    const messages = json<{
      success: true;
      data: { messages: { kind: string; pollId: string | null }[] };
    }>(chat).data.messages;
    assert.equal(messages.some((row) => row.kind === 'poll' && row.pollId === poll.id), true);

    const strangerBlocked = await send(
      'GET',
      `/api/v1/trips/${tripId}/polls/${poll.id}`,
      undefined,
      stranger.accessToken,
    );
    assert.equal(strangerBlocked.status, 403);

    const firstVote = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls/${poll.id}/vote`,
      { optionIds: [taj] },
      member.accessToken,
    );
    assert.equal(firstVote.status, 200);
    const afterFirst = json<{ success: true; data: PollRow }>(firstVote).data;
    assert.equal(afterFirst.ownOptionIds[0], taj);
    assert.equal(afterFirst.options.find((option) => option.id === taj)?.voteCount, 1);

    const changed = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls/${poll.id}/vote`,
      { optionIds: [marriott] },
      member.accessToken,
    );
    assert.equal(changed.status, 200);
    const afterChange = json<{ success: true; data: PollRow }>(changed).data;
    assert.equal(afterChange.ownOptionIds[0], marriott);
    assert.equal(afterChange.options.find((option) => option.id === taj)?.voteCount, 0);
    assert.equal(afterChange.options.find((option) => option.id === marriott)?.voteCount, 1);
    assert.equal(afterChange.votedCount, 1);

    const [left, right] = await Promise.all([
      send(
        'POST',
        `/api/v1/trips/${tripId}/polls/${poll.id}/vote`,
        { optionIds: [taj] },
        owner.accessToken,
      ),
      send(
        'POST',
        `/api/v1/trips/${tripId}/polls/${poll.id}/vote`,
        { optionIds: [marriott] },
        owner.accessToken,
      ),
    ]);
    assert.equal(left.status, 200);
    assert.equal(right.status, 200);
    const latest = await send(
      'GET',
      `/api/v1/trips/${tripId}/polls/${poll.id}`,
      undefined,
      owner.accessToken,
    );
    const latestPoll = json<{ success: true; data: PollRow }>(latest).data;
    assert.equal(latestPoll.ownOptionIds.length, 1);
    assert.equal(latestPoll.votedCount, 2);

    const closed = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls/${poll.id}/close`,
      {},
      owner.accessToken,
    );
    assert.equal(closed.status, 200);
    const closedVote = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls/${poll.id}/vote`,
      { optionIds: [taj] },
      member.accessToken,
    );
    assert.equal(closedVote.status, 409);
  });

  it('hides voters on anonymous polls and does not invent a winner on a tie', async () => {
    const owner = await register('Owner Anon', 'owner-anon@example.com');
    const member = await register('Member Anon', 'member-anon@example.com');
    const tripId = await createTrip(owner.accessToken);
    await inviteAndAccept(tripId, owner, member);

    const created = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls`,
      {
        question: 'Which beach?',
        anonymous: true,
        options: [{ label: 'Baga' }, { label: 'Palolem' }],
      },
      owner.accessToken,
    );
    assert.equal(created.status, 201);
    const poll = json<{ success: true; data: PollRow }>(created).data;
    const baga = poll.options[0]?.id;
    const palolem = poll.options[1]?.id;
    assert.ok(baga && palolem);

    await send(
      'POST',
      `/api/v1/trips/${tripId}/polls/${poll.id}/vote`,
      { optionIds: [baga] },
      owner.accessToken,
    );
    const voted = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls/${poll.id}/vote`,
      { optionIds: [palolem] },
      member.accessToken,
    );
    assert.equal(voted.status, 200);
    const result = json<{ success: true; data: PollRow }>(voted).data;
    assert.equal(result.anonymous, true);
    assert.equal(result.options.every((option) => option.voters === null), true);
    assert.equal(result.result.kind, 'tie');
    assert.equal(result.result.optionIds.length, 2);
  });

  it('rejects expired votes, blocks other trips, and does not add a poll to the itinerary', async () => {
    const owner = await register('Owner Final', 'owner-final@example.com');
    const member = await register('Member Final', 'member-final@example.com');
    const stranger = await register('Stranger Final', 'stranger-final@example.com');
    const tripId = await createTrip(owner.accessToken);
    const otherTrip = await createTrip(stranger.accessToken);
    await inviteAndAccept(tripId, owner, member);

    const expired = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls`,
      {
        question: 'Already over?',
        deadlineAt: new Date(Date.now() - 60_000).toISOString(),
        options: [{ label: 'Yes' }, { label: 'No' }],
      },
      owner.accessToken,
    );
    assert.equal(expired.status, 400);

    const created = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls`,
      {
        question: 'Which activity?',
        category: 'activity',
        options: [{ label: 'Dudhsagar' }, { label: 'Spice farm' }],
      },
      owner.accessToken,
    );
    assert.equal(created.status, 201);
    const poll = json<{ success: true; data: PollRow }>(created).data;
    const first = poll.options[0]?.id;
    assert.ok(first);

    const cross = await send(
      'GET',
      `/api/v1/trips/${otherTrip}/polls/${poll.id}`,
      undefined,
      stranger.accessToken,
    );
    assert.equal(cross.status, 404);

    const vote = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls/${poll.id}/vote`,
      { optionIds: [first] },
      member.accessToken,
    );
    assert.equal(vote.status, 200);

    const finalizeGone = await send(
      'POST',
      `/api/v1/trips/${tripId}/polls/${poll.id}/finalize`,
      { optionId: first, target: 'activity', date: '2026-12-03' },
      owner.accessToken,
    );
    assert.equal(finalizeGone.status, 404);

    const activities = await send(
      'GET',
      `/api/v1/trips/${tripId}/activities?date=2026-12-03`,
      undefined,
      member.accessToken,
    );
    assert.equal(activities.status, 200);
    const titles = json<{ success: true; data: { activities: { title: string }[] } }>(activities)
      .data.activities;
    assert.equal(titles.some((row) => row.title === 'Dudhsagar'), false);
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
      description: 'Decide together',
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
