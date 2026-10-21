import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canOpenMaps } from './placeDisplay';
import type { TaveloPlace } from './types';

describe('canOpenMaps', () => {
  it('allows provider places with coordinates', () => {
    const place: TaveloPlace = {
      name: 'Goa',
      formattedAddress: 'Goa, India',
      latitude: 15.2993,
      longitude: 74.124,
      placeId: '1',
      provider: 'nominatim',
      source: 'provider',
      verified: true,
    };
    assert.equal(canOpenMaps(place), true);
  });

  it('disallows manual places even with an address', () => {
    const place: TaveloPlace = {
      name: 'Farmhouse',
      formattedAddress: 'Some road, Goa',
      latitude: null,
      longitude: null,
      placeId: null,
      provider: null,
      source: 'manual',
      verified: false,
    };
    assert.equal(canOpenMaps(place), false);
  });
});
