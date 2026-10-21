export type WeatherCondition = {
  label: string;
  icon: string;
};

/** WMO weather interpretation codes (Open-Meteo). */
export function weatherCodeToCondition(code: number): WeatherCondition {
  if (code === 0) {
    return { label: 'Clear sky', icon: '☀️' };
  }
  if (code === 1) {
    return { label: 'Mainly clear', icon: '🌤️' };
  }
  if (code === 2) {
    return { label: 'Partly cloudy', icon: '⛅' };
  }
  if (code === 3) {
    return { label: 'Overcast', icon: '☁️' };
  }
  if (code === 45 || code === 48) {
    return { label: 'Fog', icon: '🌫️' };
  }
  if (code >= 51 && code <= 57) {
    return { label: 'Drizzle', icon: '🌦️' };
  }
  if (code >= 61 && code <= 67) {
    return { label: 'Rain', icon: '🌧️' };
  }
  if (code >= 71 && code <= 77) {
    return { label: 'Snow', icon: '❄️' };
  }
  if (code >= 80 && code <= 82) {
    return { label: 'Rain showers', icon: '🌧️' };
  }
  if (code >= 85 && code <= 86) {
    return { label: 'Snow showers', icon: '🌨️' };
  }
  if (code >= 95 && code <= 99) {
    return { label: 'Thunderstorm', icon: '⛈️' };
  }
  return { label: 'Weather', icon: '🌡️' };
}

export function formatTemperatureC(value: number): string {
  return `${Math.round(value)}°`;
}
