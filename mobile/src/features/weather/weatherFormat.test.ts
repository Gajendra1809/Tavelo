import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTemperatureC, weatherUpdateLabel } from './weatherFormat';

describe('weatherFormat', () => {
  it('formats temperature in Celsius', () => {
    assert.equal(formatTemperatureC(29.6), '30°');
  });

  it('prefers observation time in update label', () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const label = weatherUpdateLabel({
      fetchedAt: new Date().toISOString(),
      observationTime: recent,
      cacheStatus: 'hit',
      isStale: false,
      provider: 'open-meteo',
      attribution: 'Weather data by Open-Meteo.com',
      attributionUrl: 'https://open-meteo.com/',
      timezone: 'Asia/Kolkata',
    });
    assert.match(label, /^Observed /);
  });
});
