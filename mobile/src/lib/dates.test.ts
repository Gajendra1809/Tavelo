import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDisplayDate, formatDateRange, formatTripLength, tripLengthDays } from './dates';

describe('display dates', () => {
  it('uses day month year so month and day are never ambiguous', () => {
    assert.equal(formatDisplayDate('2026-12-25'), '25 Dec 2026');
    assert.equal(formatDateRange('2026-12-25', '2026-12-25'), '25 Dec 2026');
    assert.equal(formatDateRange('2026-12-25', '2026-12-28'), '25 Dec 2026 – 28 Dec 2026');
  });
});

describe('trip length', () => {
  it('counts inclusive calendar days from the date strings', () => {
    assert.equal(tripLengthDays('2026-11-10', '2026-11-12'), 3);
    assert.equal(tripLengthDays('2026-11-10', '2026-11-10'), 1);
    assert.equal(formatTripLength('2026-11-10', '2026-11-12'), '3 days');
    assert.equal(formatTripLength('2026-11-10', '2026-11-10'), '1 day');
  });
});
