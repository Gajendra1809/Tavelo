import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTripSchema } from './trip.schema';

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
});
