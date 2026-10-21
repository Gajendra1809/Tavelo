import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapOpenMeteoResponse } from './openMeteo.service';

describe('mapOpenMeteoResponse', () => {
  it('maps current, daily, and hourly fields', () => {
    const payload = mapOpenMeteoResponse(
      {
        timezone: 'Asia/Kolkata',
        current: {
          time: '2026-12-25T11:30',
          temperature_2m: 29.2,
          apparent_temperature: 32.1,
          weather_code: 2,
        },
        daily: {
          temperature_2m_max: [31],
          temperature_2m_min: [25],
        },
        hourly: {
          time: ['2026-12-25T12:00', '2026-12-25T13:00'],
          temperature_2m: [30, 31],
          precipitation_probability: [10, 20],
          weather_code: [2, 3],
        },
      },
      new Date('2026-12-25T06:00:00.000Z'),
    );

    assert.equal(payload.available, true);
    assert.equal(payload.current.temperatureC, 29.2);
    assert.equal(payload.current.conditionLabel, 'Partly cloudy');
    assert.equal(payload.daily?.highC, 31);
    assert.equal(payload.hourly.length, 2);
    assert.equal(payload.meta.timezone, 'Asia/Kolkata');
    assert.equal(payload.meta.provider, 'open-meteo');
  });
});
