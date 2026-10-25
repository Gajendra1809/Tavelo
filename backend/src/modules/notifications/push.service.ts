import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { PushDeviceModel } from './pushDevice.model';
import type { DeactivatePushDeviceInput, RegisterPushDeviceInput } from './push.schema';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPT_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const CHANNEL_ID = 'trip-updates';

export type PushPayload = {
  notificationId: string;
  recipientId: string;
  title: string;
  message: string;
  type: string;
  tripId?: string;
  entityType?: string;
  entityId?: string;
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  channelId: string;
  sound: 'default';
  priority: 'default';
};

export type ExpoPushTicket =
  | { status: 'ok'; id?: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

type PushTransport = (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;

let testTransport: PushTransport | null = null;

export function setPushTransportForTests(next: PushTransport | null): void {
  testTransport = next;
}

export async function registerPushDevice(
  userId: string,
  input: RegisterPushDeviceInput,
): Promise<{ registered: true }> {
  assertDatabaseConnected();
  const now = new Date();
  await PushDeviceModel.findOneAndUpdate(
    { token: input.token },
    {
      $set: {
        userId: new mongoose.Types.ObjectId(userId),
        platform: input.platform,
        active: true,
        lastSeenAt: now,
      },
    },
    { upsert: true },
  );
  return { registered: true };
}

export async function deactivatePushDevice(
  userId: string,
  input: DeactivatePushDeviceInput,
): Promise<{ deactivated: true }> {
  assertDatabaseConnected();
  const updated = await PushDeviceModel.findOneAndUpdate(
    { token: input.token, userId },
    { $set: { active: false, lastSeenAt: new Date() } },
  );
  if (!updated) {
    throw new AppError(404, 'NOT_FOUND', 'This device is not registered for your account.');
  }
  return { deactivated: true };
}

export async function deliverPushes(rows: PushPayload[]): Promise<void> {
  if (rows.length === 0 || mongoose.connection.readyState !== 1) {
    return;
  }
  const recipientIds = [...new Set(rows.map((row) => row.recipientId))];
  const devices = await PushDeviceModel.find({
    userId: { $in: recipientIds.map((id) => new mongoose.Types.ObjectId(id)) },
    active: true,
  }).select('userId token');

  const tokensByUser = new Map<string, string[]>();
  for (const device of devices) {
    const key = device.userId.toString();
    const list = tokensByUser.get(key) ?? [];
    list.push(device.token);
    tokensByUser.set(key, list);
  }

  const messages: ExpoPushMessage[] = [];
  for (const row of rows) {
    for (const token of tokensByUser.get(row.recipientId) ?? []) {
      messages.push({
        to: token,
        title: row.title,
        body: row.message,
        sound: 'default',
        priority: 'default',
        channelId: CHANNEL_ID,
        data: {
          notificationId: row.notificationId,
          type: row.type,
          tripId: row.tripId ?? '',
          entityType: row.entityType ?? '',
          entityId: row.entityId ?? '',
        },
      });
    }
  }
  if (messages.length === 0) {
    return;
  }

  const tickets = await sendMessages(messages);
  await deactivateInvalidTokens(tokensFromTicketErrors(messages, tickets));
  scheduleReceiptCheck(messages, tickets);
}

export function tokensFromTicketErrors(messages: ExpoPushMessage[], tickets: ExpoPushTicket[]): string[] {
  const invalid: string[] = [];
  tickets.forEach((ticket, index) => {
    const token = messages[index]?.to;
    if (!token) {
      return;
    }
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      invalid.push(token);
    }
  });
  return invalid;
}

export async function deactivateInvalidTokens(tokens: string[]): Promise<void> {
  const unique = [...new Set(tokens)];
  if (unique.length === 0 || mongoose.connection.readyState !== 1) {
    return;
  }
  await PushDeviceModel.updateMany({ token: { $in: unique } }, { $set: { active: false } });
}

async function sendMessages(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const transport = testTransport ?? sendWithExpo;
  const tickets: ExpoPushTicket[] = [];
  for (let index = 0; index < messages.length; index += 100) {
    const chunk = messages.slice(index, index + 100);
    const chunkTickets = await transport(chunk);
    tickets.push(...chunkTickets);
  }
  return tickets;
}

async function sendWithExpo(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  if (process.env.NODE_ENV === 'test') {
    return messages.map(() => ({ status: 'ok' as const, id: 'skipped-in-test' }));
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    throw new Error(`Expo push send failed (${response.status}).`);
  }
  const body = (await response.json()) as { data?: ExpoPushTicket[] } | ExpoPushTicket[];
  if (Array.isArray(body)) {
    return body;
  }
  return body.data ?? [];
}

function scheduleReceiptCheck(messages: ExpoPushMessage[], tickets: ExpoPushTicket[]): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const ids = tickets.flatMap((ticket, index) =>
    ticket.status === 'ok' && ticket.id ? [{ id: ticket.id, token: messages[index]?.to }] : [],
  );
  if (ids.length === 0) {
    return;
  }
  setTimeout(() => {
    void checkReceipts(ids).catch((error: unknown) => {
      console.error('[Tavelo] push receipt check failed:', error);
    });
  }, 15_000);
}

async function checkReceipts(pairs: { id: string; token?: string }[]): Promise<void> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const response = await fetch(EXPO_RECEIPT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids: pairs.map((pair) => pair.id) }),
  });
  if (!response.ok) {
    return;
  }
  const body = (await response.json()) as {
    data?: Record<string, { status?: string; details?: { error?: string } }>;
  };
  const receipts = body.data ?? {};
  const invalid = pairs
    .filter((pair) => receipts[pair.id]?.details?.error === 'DeviceNotRegistered' && pair.token)
    .map((pair) => pair.token as string);
  await deactivateInvalidTokens(invalid);
}

function assertDatabaseConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'The database is unavailable. Try again in a moment.');
  }
}
