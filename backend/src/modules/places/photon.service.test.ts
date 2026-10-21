import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapPhotonFeatures } from './photon.service';

describe('mapPhotonFeatures', () => {
  it('maps GeoJSON features to place search results', () => {
    const results = mapPhotonFeatures(
      [
        {
          geometry: { coordinates: [2.3483915, 48.8534951] },
          properties: {
            osm_id: 71525,
            osm_type: 'R',
            name: 'Paris',
            state: 'Île-de-France',
            country: 'France',
          },
        },
      ],
      8,
    );

    assert.equal(results.length, 1);
    assert.equal(results[0]?.name, 'Paris');
    assert.equal(results[0]?.provider, 'photon');
    assert.equal(results[0]?.placeId, 'photon:R:71525');
    assert.equal(results[0]?.latitude, 48.8534951);
    assert.equal(results[0]?.longitude, 2.3483915);
  });
});
