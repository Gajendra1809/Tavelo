import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTripLength, tripLengthDays } from './dates';

describe('trip length', () => {
  it('counts inclusive calendar days from the date strings', () => {
    assert.equal(tripLengthDays('2026-11-10', '2026-11-12'), 3);
    assert.equal(tripLengthDays('2026-11-10', '2026-11-10'), 1);
    assert.equal(formatTripLength('2026-11-10', '2026-11-12'), '3 days');
    assert.equal(formatTripLength('2026-11-10', '2026-11-10'), '1 day');
  });
});
