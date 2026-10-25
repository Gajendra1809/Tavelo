import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deactivatePushDeviceSchema, registerPushDeviceSchema } from './push.schema';
import { tokensFromTicketErrors, type ExpoPushMessage } from './push.service';

describe('registerPushDeviceSchema', () => {
  it('accepts an Expo token and strips extra fields', () => {
    const parsed = registerPushDeviceSchema.parse({
      token: 'ExponentPushToken[abc123]',
      platform: 'android',
      title: 'do not send',
    });
    assert.equal(parsed.token, 'ExponentPushToken[abc123]');
    assert.equal('title' in parsed, false);
  });

  it('rejects a raw FCM token', () => {
    assert.equal(registerPushDeviceSchema.safeParse({ token: 'fcm-token' }).success, false);
  });
});

describe('deactivatePushDeviceSchema', () => {
  it('requires an Expo token', () => {
    assert.equal(deactivatePushDeviceSchema.safeParse({ token: '' }).success, false);
  });
});

describe('tokensFromTicketErrors', () => {
  it('returns only DeviceNotRegistered tokens', () => {
    const messages: ExpoPushMessage[] = [
      message('ExponentPushToken[gone]'),
      message('ExponentPushToken[ok]'),
      message('ExponentPushToken[other]'),
    ];
    const invalid = tokensFromTicketErrors(messages, [
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
      { status: 'ok', id: 'ticket-1' },
      { status: 'error', details: { error: 'MessageRateExceeded' } },
    ]);
    assert.deepEqual(invalid, ['ExponentPushToken[gone]']);
  });
});

function message(token: string): ExpoPushMessage {
  return {
    to: token,
    title: 'Trip invitation',
    body: 'Join us',
    data: { notificationId: '1', type: 'trip_invitation', tripId: '', entityType: '', entityId: '' },
    channelId: 'trip-updates',
    sound: 'default',
    priority: 'default',
  };
}
