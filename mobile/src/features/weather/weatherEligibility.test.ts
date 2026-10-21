import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isWeatherEligiblePlace } from './weatherEligibility';

describe('isWeatherEligiblePlace', () => {
  it('rejects manual destinations', () => {
    assert.equal(
      isWeatherEligiblePlace({
        name: 'Goa',
        formattedAddress: null,
        latitude: null,
        longitude: null,
        placeId: null,
        provider: null,
        source: 'manual',
        verified: false,
      }),
      false,
    );
  });

  it('accepts verified provider coordinates', () => {
    assert.equal(
      isWeatherEligiblePlace({
        name: 'Goa',
        formattedAddress: 'Goa, India',
        latitude: 15.2993,
        longitude: 74.124,
        placeId: '1',
        provider: 'nominatim',
        source: 'provider',
        verified: true,
      }),
      true,
    );
  });
});
