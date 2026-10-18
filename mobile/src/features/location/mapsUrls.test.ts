import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMapsDirectionsUrl, buildMapsSearchUrl } from './mapsUrls';
import type { TaveloPlace } from './types';

const verifiedRedFort: TaveloPlace = {
  name: 'Red Fort',
  formattedAddress: 'Netaji Subhash Marg, Chandni Chowk, New Delhi, Delhi 110006',
  latitude: 28.6562,
  longitude: 77.241,
  placeId: 'mock-red-fort',
  provider: 'mock',
  source: 'provider',
  verified: true,
};

const manualOnly: TaveloPlace = {
  name: 'Secret beach spot',
  formattedAddress: null,
  latitude: null,
  longitude: null,
  placeId: null,
  provider: null,
  source: 'manual',
  verified: false,
};

describe('mapsUrls', () => {
  it('uses lat,lng for verified places', () => {
    assert.equal(
      buildMapsDirectionsUrl(verifiedRedFort),
      'https://www.google.com/maps/dir/?api=1&destination=28.6562,77.241',
    );
    assert.equal(
      buildMapsSearchUrl(verifiedRedFort),
      'https://www.google.com/maps/search/?api=1&query=28.6562,77.241',
    );
  });

  it('falls back to encoded query for manual places', () => {
    const url = buildMapsDirectionsUrl(manualOnly);
    assert.match(url, /destination=Secret%20beach%20spot/);
  });
});
