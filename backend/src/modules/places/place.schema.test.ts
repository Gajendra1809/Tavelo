import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { taveloPlaceSchema } from './place.schema';

describe('taveloPlaceSchema', () => {
  it('accepts a verified provider place with coordinates', () => {
    const parsed = taveloPlaceSchema.parse({
      name: 'Red Fort',
      formattedAddress: 'Delhi, India',
      latitude: 28.6562,
      longitude: 77.241,
      placeId: '123',
      provider: 'nominatim',
      source: 'provider',
      verified: true,
    });
    assert.equal(parsed.verified, true);
    assert.equal(parsed.latitude, 28.6562);
  });

  it('rejects mismatched latitude and longitude', () => {
    assert.equal(
      taveloPlaceSchema.safeParse({
        name: 'Somewhere',
        latitude: 12,
        longitude: null,
        source: 'manual',
        verified: false,
      }).success,
      false,
    );
  });

  it('accepts manual text-only places', () => {
    const parsed = taveloPlaceSchema.parse({
      name: 'Secret spot',
      source: 'manual',
      verified: false,
    });
    assert.equal(parsed.latitude, null);
    assert.equal(parsed.longitude, null);
  });
});
