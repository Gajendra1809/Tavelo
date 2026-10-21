import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { weatherCoordinatesFromPlace, weatherUnavailableReason } from './weatherEligibility';

describe('weatherEligibility', () => {
  it('rejects manual destinations', () => {
    assert.equal(
      weatherUnavailableReason({
        name: 'Goa',
        source: 'manual',
        verified: false,
      }),
      'manual_location',
    );
    assert.equal(
      weatherCoordinatesFromPlace({
        name: 'Goa',
        source: 'manual',
        verified: false,
      }),
      null,
    );
  });

  it('accepts verified provider coordinates', () => {
    const coords = weatherCoordinatesFromPlace({
      name: 'Goa',
      source: 'provider',
      verified: true,
      latitude: 15.2993,
      longitude: 74.124,
    });
    assert.deepEqual(coords, { latitude: 15.2993, longitude: 74.124 });
    assert.equal(weatherUnavailableReason({
      name: 'Goa',
      source: 'provider',
      verified: true,
      latitude: 15.2993,
      longitude: 74.124,
    }), null);
  });
});
