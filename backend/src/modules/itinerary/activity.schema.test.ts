import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createActivitySchema, updateActivitySchema } from './activity.schema';

describe('createActivitySchema', () => {
  it('accepts a flexible activity and strips identity fields', () => {
    const parsed = createActivitySchema.parse({
      title: '  Fort walk ',
      date: '2026-11-10',
      tripId: '507f1f77bcf86cd799439011',
      createdBy: '507f1f77bcf86cd799439012',
    });
    assert.equal(parsed.title, 'Fort walk');
    assert.equal(parsed.startTime, undefined);
    assert.equal('tripId' in parsed, false);
  });

  it('rejects an end time before the start time', () => {
    assert.equal(
      createActivitySchema.safeParse({
        title: 'Tea',
        date: '2026-11-10',
        startTime: '14:00',
        endTime: '13:00',
      }).success,
      false,
    );
  });

  it('rejects a date outside real calendar bounds', () => {
    assert.equal(
      createActivitySchema.safeParse({ title: 'Tea', date: '2026-02-30' }).success,
      false,
    );
  });
});

describe('updateActivitySchema', () => {
  it('rejects an empty patch', () => {
    assert.equal(updateActivitySchema.safeParse({}).success, false);
  });
});
