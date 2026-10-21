import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTemperatureC, weatherCodeToCondition } from './weatherCodes';

describe('weatherCodeToCondition', () => {
  it('maps clear and partly cloudy codes', () => {
    assert.equal(weatherCodeToCondition(0).label, 'Clear sky');
    assert.equal(weatherCodeToCondition(2).label, 'Partly cloudy');
  });

  it('formats Celsius temperatures', () => {
    assert.equal(formatTemperatureC(29.4), '29°');
    assert.equal(formatTemperatureC(-1.2), '-1°');
  });
});
