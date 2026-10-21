import type { WeatherUnavailableReason } from './weatherEligibility';

export type WeatherHourlyPoint = {
  time: string;
  temperatureC: number;
  precipitationProbability: number | null;
  weatherCode: number;
  conditionLabel: string;
  conditionIcon: string;
};

export type TripWeatherPayload = {
  available: true;
  current: {
    temperatureC: number;
    apparentTemperatureC: number | null;
    weatherCode: number;
    conditionLabel: string;
    conditionIcon: string;
    observationTime: string | null;
  };
  daily: {
    highC: number;
    lowC: number;
  } | null;
  hourly: WeatherHourlyPoint[];
  meta: {
    fetchedAt: string;
    observationTime: string | null;
    cacheStatus: 'hit' | 'miss' | 'stale';
    isStale: boolean;
    provider: 'open-meteo';
    attribution: string;
    attributionUrl: string;
    timezone: string | null;
  };
};

export type TripWeatherUnavailable = {
  available: false;
  reason: WeatherUnavailableReason;
  message: string;
};

export type TripWeatherResponse = TripWeatherPayload | TripWeatherUnavailable;
