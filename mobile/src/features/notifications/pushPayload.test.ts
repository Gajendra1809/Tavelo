import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { notificationFromPushData } from './pushPayload';

describe('notificationFromPushData', () => {
  it('keeps the ids the app uses to open the right screen', () => {
    const item = notificationFromPushData({
      type: 'chat_message',
      tripId: 'trip-1',
      entityType: 'message',
      entityId: 'message-1',
      notificationId: 'notice-1',
    });
    assert.equal(item?.type, 'chat_message');
    assert.equal(item?.trip?.id, 'trip-1');
    assert.equal(item?.entityType, 'message');
    assert.equal(item?.entityId, 'message-1');
  });

  it('ignores an empty payload', () => {
    assert.equal(notificationFromPushData(undefined), null);
    assert.equal(notificationFromPushData({ type: '  ' }), null);
  });
});
