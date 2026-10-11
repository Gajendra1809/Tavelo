import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTripSchema, updateTripSchema } from './trip.schema';

const validTrip = {
  name: 'Coast weekend',
  destination: 'Galle',
  startDate: '2026-11-02',
  endDate: '2026-11-05',
  description: 'A short trip.',
};

describe('createTripSchema', () => {
  it('accepts a complete trip and trims text', () => {
    const parsed = createTripSchema.parse({
      ...validTrip,
      name: '  Coast weekend  ',
      description: '  A short trip.  ',
    });

    assert.equal(parsed.name, 'Coast weekend');
    assert.equal(parsed.description, 'A short trip.');
  });

  it('rejects an end date before the start date', () => {
    const result = createTripSchema.safeParse({
      ...validTrip,
      startDate: '2026-11-05',
      endDate: '2026-11-02',
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.issues.some((issue) => issue.path.join('.') === 'endDate'), true);
    }
  });

  it('rejects an impossible calendar date', () => {
    const result = createTripSchema.safeParse({
      ...validTrip,
      startDate: '2026-02-31',
    });

    assert.equal(result.success, false);
  });

  it('allows an empty description', () => {
    const parsed = createTripSchema.parse({
      name: 'Coast weekend',
      destination: 'Galle',
      startDate: '2026-11-02',
      endDate: '2026-11-02',
    });

    assert.equal(parsed.description, '');
  });

  it('ignores a client-supplied creator id', () => {
    const parsed = createTripSchema.parse({
      ...validTrip,
      creatorId: '507f1f77bcf86cd799439011',
      ownerId: '507f1f77bcf86cd799439011',
      members: [{ userId: '507f1f77bcf86cd799439011', role: 'owner' }],
    });

    assert.equal('creatorId' in parsed, false);
    assert.equal('ownerId' in parsed, false);
    assert.equal('members' in parsed, false);
  });
});

describe('updateTripSchema', () => {
  it('accepts a partial update', () => {
    const parsed = updateTripSchema.parse({ name: '  Hill country  ' });
    assert.equal(parsed.name, 'Hill country');
  });

  it('rejects an empty update', () => {
    assert.equal(updateTripSchema.safeParse({}).success, false);
  });

  it('rejects an end date before the start date', () => {
    const result = updateTripSchema.safeParse({
      startDate: '2026-12-10',
      endDate: '2026-12-01',
    });
    assert.equal(result.success, false);
  });

});
