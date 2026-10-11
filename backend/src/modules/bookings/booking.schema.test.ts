import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createBookingSchema, updateBookingSchema } from './booking.schema';

describe('booking schema', () => {
  it('accepts a minimal valid booking', () => {
    const parsed = createBookingSchema.parse({
      title: 'Rajanvansh Hotel',
      category: 'hotel',
      startDate: '2026-01-27',
    });
    assert.equal(parsed.title, 'Rajanvansh Hotel');
    assert.equal(parsed.category, 'hotel');
  });

  it('rejects end date before start date', () => {
    assert.throws(() =>
      createBookingSchema.parse({
        title: 'Train',
        category: 'train',
        startDate: '2026-01-30',
        endDate: '2026-01-29',
      }),
    );
  });

  it('allows partial updates with date refinement', () => {
    const parsed = updateBookingSchema.parse({
      endDate: '2026-02-01',
      startDate: '2026-01-27',
    });
    assert.equal(parsed.endDate, '2026-02-01');
  });
});
