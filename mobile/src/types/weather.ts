export type WeatherHourlyPoint = {
  time: string;
  temperatureC: number;
  precipitationProbability: number | null;
  weatherCode: number;
  conditionLabel: string;
  conditionIcon: string;
};

export type TripWeatherMeta = {
  fetchedAt: string;
  observationTime: string | null;
  cacheStatus: 'hit' | 'miss' | 'stale';
  isStale: boolean;
  provider: 'open-meteo';
  attribution: string;
  attributionUrl: string;
  timezone: string | null;
};

export type TripWeatherData = {
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
  meta: TripWeatherMeta;
};

export type TripWeatherUnavailable = {
  available: false;
  reason: 'manual_location' | 'missing_coordinates';
  message: string;
};

export type TripWeatherResponse = TripWeatherData | TripWeatherUnavailable;
