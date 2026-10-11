import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import mongoose from 'mongoose';
import {
  assertAvatarObjectKey,
  assertTripCoverObjectKey,
  buildAvatarObjectKey,
  buildTripCoverObjectKey,
  buildTripMemoryObjectKey,
  assertTripMemoryObjectKey,
  buildBookingAttachmentObjectKey,
  assertBookingAttachmentObjectKey,
  extensionForContentType,
  resolveStoredContentType,
  ALLOWED_BOOKING_DOCUMENT_TYPES,
} from './policy';

describe('storage policy', () => {
  it('maps content types to file extensions', () => {
    assert.equal(extensionForContentType('image/jpeg'), 'jpg');
    assert.equal(extensionForContentType('image/png'), 'png');
    assert.equal(extensionForContentType('image/webp'), 'webp');
    assert.equal(extensionForContentType('video/mp4'), 'mp4');
    assert.equal(extensionForContentType('application/pdf'), 'pdf');
  });

  it('builds keys under the expected prefixes', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const tripId = new mongoose.Types.ObjectId().toString();
    const avatarKey = buildAvatarObjectKey(userId, 'image/png');
    const coverKey = buildTripCoverObjectKey(tripId, 'image/jpeg');
    assert.ok(avatarKey.startsWith(`users/${userId}/avatar/`));
    assert.ok(coverKey.startsWith(`trips/${tripId}/cover/`));
    assertAvatarObjectKey(userId, avatarKey);
    assertTripCoverObjectKey(tripId, coverKey);
    const memoryKey = buildTripMemoryObjectKey(tripId, 'video/mp4');
    assert.ok(memoryKey.startsWith(`trips/${tripId}/media/`));
    assertTripMemoryObjectKey(tripId, memoryKey);
    const bookingId = new mongoose.Types.ObjectId().toString();
    const bookingKey = buildBookingAttachmentObjectKey(tripId, bookingId, 'application/pdf');
    assert.ok(bookingKey.startsWith(`trips/${tripId}/bookings/${bookingId}/`));
    assert.ok(bookingKey.endsWith('.pdf'));
    assertBookingAttachmentObjectKey(tripId, bookingId, bookingKey);
  });

  it('resolves octet-stream from object key extension', () => {
    const resolved = resolveStoredContentType(
      'application/octet-stream',
      'trips/x/bookings/y/z.jpg',
      ALLOWED_BOOKING_DOCUMENT_TYPES,
    );
    assert.equal(resolved, 'image/jpeg');
  });

  it('rejects mismatched object keys', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const otherId = new mongoose.Types.ObjectId().toString();
    assert.throws(() => assertAvatarObjectKey(userId, `users/${otherId}/avatar/x.jpg`));
  });
});
