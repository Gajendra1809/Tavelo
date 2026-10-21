import { weatherCodeToCondition } from './weatherCodes';
import type { TripWeatherPayload } from './weather.types';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const UPSTREAM_TIMEOUT_MS = 12_000;
const HOURLY_HOURS = 12;

type OpenMeteoCurrent = {
  time?: string;
  temperature_2m?: number;
  apparent_temperature?: number;
  weather_code?: number;
};

type OpenMeteoResponse = {
  timezone?: string;
  current?: OpenMeteoCurrent;
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

export async function fetchOpenMeteoForecast(
  latitude: number,
  longitude: number,
): Promise<TripWeatherPayload> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code');
  url.searchParams.set(
    'hourly',
    'temperature_2m,precipitation_probability,weather_code',
  );
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '7');

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo HTTP ${response.status}`);
  }

  const body = (await response.json()) as OpenMeteoResponse;
  return mapOpenMeteoResponse(body);
}

export function mapOpenMeteoResponse(
  body: OpenMeteoResponse,
  fetchedAt = new Date(),
): TripWeatherPayload {
  const current = body.current;
  const code = current?.weather_code ?? 0;
  const condition = weatherCodeToCondition(code);
  const temperature = current?.temperature_2m;
  if (temperature === undefined || !Number.isFinite(temperature)) {
    throw new Error('Open-Meteo response missing current temperature');
  }

  const apparent =
    current?.apparent_temperature !== undefined && Number.isFinite(current.apparent_temperature)
      ? current.apparent_temperature
      : null;

  const observationTime = current?.time ?? null;
  const fetchedAtIso = fetchedAt.toISOString();

  const dailyMax = body.daily?.temperature_2m_max?.[0];
  const dailyMin = body.daily?.temperature_2m_min?.[0];
  const daily =
    dailyMax !== undefined &&
    dailyMin !== undefined &&
    Number.isFinite(dailyMax) &&
    Number.isFinite(dailyMin)
      ? { highC: dailyMax, lowC: dailyMin }
      : null;

  const hourly: TripWeatherPayload['hourly'] = [];
  const times = body.hourly?.time ?? [];
  const temps = body.hourly?.temperature_2m ?? [];
  const probs = body.hourly?.precipitation_probability ?? [];
  const codes = body.hourly?.weather_code ?? [];
  const limit = Math.min(HOURLY_HOURS, times.length);
  for (let i = 0; i < limit; i += 1) {
    const time = times[i];
    const temp = temps[i];
    if (!time || temp === undefined || !Number.isFinite(temp)) {
      continue;
    }
    const hourlyCode = codes[i] ?? 0;
    const hourlyCondition = weatherCodeToCondition(hourlyCode);
    const probRaw = probs[i];
    hourly.push({
      time,
      temperatureC: temp,
      precipitationProbability:
        probRaw !== undefined && Number.isFinite(probRaw) ? probRaw : null,
      weatherCode: hourlyCode,
      conditionLabel: hourlyCondition.label,
      conditionIcon: hourlyCondition.icon,
    });
  }

  return {
    available: true,
    current: {
      temperatureC: temperature,
      apparentTemperatureC: apparent,
      weatherCode: code,
      conditionLabel: condition.label,
      conditionIcon: condition.icon,
      observationTime,
    },
    daily,
    hourly,
    meta: {
      fetchedAt: fetchedAtIso,
      observationTime,
      cacheStatus: 'miss',
      isStale: false,
      provider: 'open-meteo',
      attribution: 'Weather data by Open-Meteo.com',
      attributionUrl: 'https://open-meteo.com/',
      timezone: body.timezone ?? null,
    },
  };
}
